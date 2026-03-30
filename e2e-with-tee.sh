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
TUNETREES_BASELINE_SEED="${REPO_ROOT}/supabase/seeds/baseline_local_20260217.sql"

usage() {
    cat <<EOF
Usage: $(basename "$0") [-r] [-f | -p] [-- playwright-args...]

Options:
  -r    Show Playwright HTML report after the run.
  -f    Do a full shared Supabase reset first.
        This wipes the shared local instance, including cubefsrs schemas/tables.
  -p    Do a TuneTrees-focused fresh-data reset first.
        This truncates auth.users (cascade) and the public schema data, then
        reseeds shared auth users and the TuneTrees baseline public seed.
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

    for candidate in "${parent}/rhizome" "${grandparent}/rhizome"; do
        if repo_has_package_json "${candidate}"; then
            printf '%s\n' "${candidate}"
            return 0
        fi
    done

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

    echo "Unable to locate the rhizome repository. Set RHIZOME_REPO_PATH to the rhizome repo root." >&2
    exit 1
}

pg() {
    psql -d "${DB_URL}" --no-psqlrc -v ON_ERROR_STOP=1 "$@"
}

apply_tunetrees_public_baseline_seed() {
    {
        printf 'SET session_replication_role = replica;\n'
        awk '
            /^INSERT INTO "public"\./ {
                in_public_insert = 1
                print
                next
            }
            in_public_insert {
                print
                if ($0 ~ /;[[:space:]]*$/) {
                    in_public_insert = 0
                }
            }
        ' "${TUNETREES_BASELINE_SEED}"
        printf '\nRESET session_replication_role;\n'
    } | pg -q
}

refresh_auth_state() {
    echo "==> Refreshing Playwright auth state"
    rm -rf "${AUTH_DIR}"
    FORCE_COLOR=1 op run --env-file="${ENV_FILE}" -- \
    npx playwright test --reporter=list e2e/setup/auth.setup.ts --project=setup
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
        ./scripts/db-push-local.sh --migrations-only "${REPO_ROOT}"
    )

    echo "==> Applying TuneTrees baseline public seed"
    apply_tunetrees_public_baseline_seed

    refresh_auth_state
}

run_public_and_auth_reseed() {
    local rhizome_repo
    rhizome_repo="$(find_rhizome_repo)"

    echo "==> Truncating auth.users and public schema data"
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
        EXECUTE 'TRUNCATE TABLE ' || public_tables || ' RESTART IDENTITY CASCADE';
    END IF;
END $$;

-- auth-owned tables can cascade into sequences this role does not own.
-- We only need to clear auth rows here, not renumber internal auth sequences.
TRUNCATE TABLE auth.users CASCADE;
SQL

    echo "==> Reseeding shared auth users"
    (
        cd "${rhizome_repo}"
        bash ./scripts/seed-shared-auth-users-local.sh
    )

    echo "==> Reseeding TuneTrees public baseline"
    apply_tunetrees_public_baseline_seed

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

