#!/usr/bin/env bash
set -euo pipefail

SHOW_REPORT=false
RESET_MODE="none"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
ENV_FILE="${REPO_ROOT}/.env.local.template"
AUTH_DIR="${REPO_ROOT}/e2e/.auth"
DB_PORT="${DB_PORT:-54322}"
DB_URL="${DB_URL:-postgres://postgres:postgres@localhost:${DB_PORT}/postgres}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [-r] [-f | -p] [-- playwright-args...]

Options:
  -r    Show Playwright HTML report after the run.
  -f    Do a full shared Supabase reset first.
        This wipes the shared local instance, including cubefsrs schemas/tables.
  -p    Do a TuneTrees-focused fresh-data reset first.
      This truncates auth.users (cascade) and all TuneTrees public data,
      then reseeds shared auth users and reapplies TuneTrees migrations/seeds.
  -h    Show this help.
EOF
}

repo_has_package_json() {
    local dir_path="$1"
    [[ -f "${dir_path}/package.json" ]]
}

find_rhizome_repo() {
    if [[ -n "${RHIZOME_REPO_PATH:-}" ]] && repo_has_package_json "${RHIZOME_REPO_PATH}"; then
        printf '%s\n' "${RHIZOME_REPO_PATH}"
        return 0
    fi

    local parent grandparent candidate worktrees_dir worktree_candidate
    parent="$(cd "${REPO_ROOT}/.." && pwd)"
    grandparent="$(cd "${REPO_ROOT}/../.." && pwd)"

    worktrees_dir="${grandparent}/rhizome.worktrees"
    if [[ -d "${worktrees_dir}" ]]; then
        shopt -s nullglob
        for worktree_candidate in "${worktrees_dir}"/*; do
            if repo_has_package_json "${worktree_candidate}"; then
                printf '%s\n' "${worktree_candidate}"
                shopt -u nullglob
                return 0
            fi
        done
        shopt -u nullglob
    fi

    for candidate in "${parent}/rhizome" "${grandparent}/rhizome"; do
        if repo_has_package_json "${candidate}"; then
            printf '%s\n' "${candidate}"
            return 0
        fi
    done

    echo "Unable to locate the rhizome repository. Set RHIZOME_REPO_PATH to the rhizome repo root." >&2
    exit 1
}

pg() {
    psql -d "${DB_URL}" --no-psqlrc -v ON_ERROR_STOP=1 "$@"
}

drop_public_tables() {
    pg <<'SQL'
DO $$
DECLARE
    public_tables text;
BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
      INTO public_tables
      FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename NOT IN ('spatial_ref_sys');

    IF public_tables IS NOT NULL THEN
        EXECUTE 'DROP TABLE ' || public_tables || ' CASCADE';
    END IF;
END $$;
SQL
}

clear_tunetrees_migration_tracking() {
    local migration_versions=()
    local migration_file
    local version
    local versions_csv

    shopt -s nullglob
    for migration_file in "${REPO_ROOT}/supabase/migrations"/*.sql; do
        version="$(basename "${migration_file}" .sql)"
        version="${version%%_*}"
        migration_versions+=("'${version}'")
    done
    shopt -u nullglob

    if [[ "${#migration_versions[@]}" -eq 0 ]]; then
        return 0
    fi

    versions_csv="$(IFS=,; printf '%s' "${migration_versions[*]}")"
    echo "==> Clearing TuneTrees migration tracking"
    pg -c "DELETE FROM supabase_migrations.schema_migrations WHERE version IN (${versions_csv});"
}

reset_tunetrees_storage_artifacts() {
    echo "==> Resetting TuneTrees storage artifacts"
    pg <<'SQL'
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
SQL
}

refresh_auth_state() {
    echo "==> Refreshing Playwright auth state"
    rm -rf "${AUTH_DIR}"
    FORCE_COLOR=1 op run --env-file="${ENV_FILE}" -- \
    npx playwright test --reporter=list e2e/setup/auth.setup.ts --project=setup
}

reapply_tunetrees_schema_and_seed() {
    local rhizome_repo="$1"

    echo "==> Reapplying TuneTrees migrations + seeds"
    (
        cd "${rhizome_repo}"
        ./scripts/db-push-local.sh "${REPO_ROOT}"
    )
}

run_full_supabase_reset() {
    local rhizome_repo
    rhizome_repo="$(find_rhizome_repo)"

    echo "==> Full shared Supabase reset via rhizome"
    echo "    WARNING: this wipes the shared local instance, including cubefsrs schemas/tables."

    (
        cd "${rhizome_repo}"
        npx supabase db reset --local
        bash ./scripts/seed-shared-auth-users-local.sh
    )

    reapply_tunetrees_schema_and_seed "${rhizome_repo}"

    refresh_auth_state
}

run_public_and_auth_reseed() {
    local rhizome_repo
    rhizome_repo="$(find_rhizome_repo)"

    echo "==> Truncating auth.users and rebuilding TuneTrees public schema"
    pg <<'SQL'
-- auth-owned tables can cascade into sequences this role does not own.
-- We only need to clear auth rows here, not renumber internal auth sequences.
TRUNCATE TABLE auth.users CASCADE;
SQL

    drop_public_tables
    reset_tunetrees_storage_artifacts
    clear_tunetrees_migration_tracking

    echo "==> Reseeding shared auth users"
    (
        cd "${rhizome_repo}"
        bash ./scripts/seed-shared-auth-users-local.sh
    )

    reapply_tunetrees_schema_and_seed "${rhizome_repo}"

    refresh_auth_state
}

while getopts "rfph" opt; do
    case "$opt" in
        r) SHOW_REPORT=true ;;
        f)
            if [ "$RESET_MODE" != "none" ]; then
                echo "Choose only one reset mode: -f or -p" >&2
                exit 1
            fi
            RESET_MODE="full"
            ;;
        p)
            if [ "$RESET_MODE" != "none" ]; then
                echo "Choose only one reset mode: -f or -p" >&2
                exit 1
            fi
            RESET_MODE="public"
            ;;
        h)
            usage
            exit 0
            ;;
        *) ;;
    esac
done
shift $((OPTIND - 1))

mkdir -p logs

LOG_FILE="logs/test-e2e-chromium-both-html.log"
rm -f "$LOG_FILE"

case "$RESET_MODE" in
    full)
        run_full_supabase_reset
        ;;
    public)
        run_public_and_auth_reseed
        ;;
esac

SECONDS=0
npm run test:e2e:chromium:both:html -- "$@" 2>&1 | tee "$LOG_FILE"
# npm run test:e2e:chromium:html -- "$@" 2>&1 | tee "$LOG_FILE"
MINUTES=$(echo "scale=2; $SECONDS / 60" | bc)
echo "Test completed in ${MINUTES}m" | tee -a "$LOG_FILE"

echo "logs are in $LOG_FILE"

if command -v code >/dev/null 2>&1; then
    if [ -n "${VSCODE_IPC_HOOK_CLI:-}" ] || [ "${TERM_PROGRAM:-}" = "vscode" ]; then
        code --reuse-window "$LOG_FILE" >/dev/null 2>&1 || true
    fi
fi

if [ "$SHOW_REPORT" = true ]; then
    npx playwright show-report
fi

