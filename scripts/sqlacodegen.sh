#!/usr/bin/env bash
# scripts/sqlacodegen.sh
# Generate SQLAlchemy models from an existing database using sqlacodegen.
# Usage: ./scripts/sqlacodegen.sh --db-url "<DB_URL>" [--output path/to/models.py]
# If DB_URL is omitted, uses $DATABASE_URL or exits.

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"

usage() {
    cat <<EOF
$SCRIPT_NAME — generate SQLAlchemy models via sqlacodegen

Usage:
    $SCRIPT_NAME --db-url "<DB_URL>" [--output <path>]

Options:
    --db-url    Database URL (eg. sqlite:///./tunetrees.db). Can also be provided via DATABASE_URL env var.
    --output    Output file path for generated models. Default: tunetrees/app/models.py
    -h, --help  Show this help and exit.

Notes:
    - Requires 'sqlacodegen' on PATH (pip install sqlacodegen).
    - Script will create a timestamped backup of the output file if it already exists.
    - Runs 'python -m ruff format' on the generated file if ruff is available.
EOF
}

# defaults
OUT="tunetrees/models/tunetrees.py"
DB_URL="sqlite:///tunetrees_test_clean.sqlite3"

# simple arg parse
while [[ $# -gt 0 ]]; do
    case "$1" in
        --db-url)
            DB_URL="$2"; shift 2;;
        --output)
            OUT="$2"; shift 2;;
        -h|--help)
            usage; exit 0;;
        *)
            echo "Unknown arg: $1"; usage; exit 2;;
    esac
done

if [[ -z "$DB_URL" ]]; then
    echo "Error: no database URL provided. Use --db-url or set DATABASE_URL."
    exit 2
fi

if ! command -v sqlacodegen_v2 >/dev/null 2>&1; then
    echo "Error: sqlacodegen not found on PATH. Install with: pip install sqlacodegen"
    exit 3
fi

# ensure output directory exists
OUT_DIR="$(dirname "$OUT")"
mkdir -p "$OUT_DIR"

# backup existing file
if [[ -f "$OUT" ]]; then
    OUT_FILE="$(basename "$OUT")"
    BACKUP="./tunetrees_local_backup/${OUT_FILE}.backup.${TIMESTAMP}"
    echo "Backing up existing $OUT -> $BACKUP"
    cp "$OUT" "$BACKUP"
fi

echo "Generating models to $OUT from $DB_URL"
# run sqlacodegen. Use --noviews to skip SQL views (adjust flags as needed).
# Write to a temp file first to avoid partial writes on failure.
TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT

sqlacodegen_v2 "$DB_URL" --outfile "$TMP_OUT"

# replace file atomically
mv "$TMP_OUT" "$OUT"
trap - EXIT

# optional formatting with ruff if available
if command -v python >/dev/null 2>&1 && python -m ruff --version >/dev/null 2>&1; then
    echo "Formatting generated file to match typical VS Code Python formatter setup..."

    # Prefer import sorting first (isort), then Black, then ruff as a final pass.
    # This matches common VS Code setups where isort + Black are used as the formatter chain.
    if python -m isort --version >/dev/null 2>&1; then
        echo "Running isort..."
        python -m isort "$OUT"
    fi

    if python -m black --version >/dev/null 2>&1; then
        echo "Running black..."
        python -m black --quiet "$OUT"
    fi

    echo "Running ruff format (final pass)..."
    python -m ruff format "$OUT"
fi

python - "$OUT" <<'PY'
import sys
path = sys.argv[1]
target = "from sqlalchemy.orm.base import Mapped"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
with open(path, "w", encoding="utf-8") as f:
    for line in lines:
        if line.strip() == target:
            continue
        f.write(line)
PY

echo "SQLAlchemy models generated: $OUT"
