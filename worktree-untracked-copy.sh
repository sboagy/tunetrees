#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# worktree-untracked-copy.sh
# Placeholder script. Add real logic when requirements are defined.
#
# Usage:
#   ./worktree-untracked-copy.sh

main() {
    local src_root="../../tunetrees"
    local dest_root
    dest_root="$(pwd)"

    if [[ ! -d "$src_root" ]]; then
        echo "error: source directory not found: $src_root" >&2
        return 2
    fi

    # Enable Bash extended globbing behaviors:
    # - globstar: allow '**' to match recursively across directories
    # - nullglob: unmatched globs expand to nothing (instead of staying literal)
    # - dotglob: include dotfiles (e.g., .gitignore) in pathname expansions
    shopt -s nullglob dotglob

    # globstar requires Bash >= 4 (macOS system Bash is often 3.2).
    if shopt -s globstar 2>/dev/null; then
        :
    else
        # Try to re-exec with Homebrew Bash if available.
        for candidate in /opt/homebrew/bin/bash /usr/local/bin/bash; do
            if [[ -x "$candidate" ]]; then
                exec "$candidate" "$0" "$@"
            fi
        done

        echo "error: this script requires 'globstar' (Bash >= 4). Install a newer bash (e.g. 'brew install bash') and re-run." >&2
        return 2
    fi

    # Copy a small set of common untracked/local-only files, preserving paths.
    for src in \
        "$src_root"/.env \
        "$src_root"/.env.* \
        "$src_root"/*.db \
        "$src_root"/*.pem \
        "$src_root"/*.crt \
        "$src_root"/*.key \
        "$src_root"/*.code-workspace \
        "$src_root"/.vscode/settings.json \
        "$src_root"/.vscode/launch.json \
        "$src_root"/**/.dev.* \
        "$src_root"/**/*.local \
        "$src_root"/**/*.secret* \
        "$src_root"/**/*secrets* \
        "$src_root"/**/*.secrets.*; do

        [[ -e "$src" || -L "$src" ]] || continue

        rel="${src#"$src_root"/}"
        mkdir -p "$dest_root/$(dirname "$rel")"
        cp -a "$src" "$dest_root/$rel"
        echo "copied: $rel"
    done

    # cp ../../tunetrees/worker/.dev.vars ./worker/.dev.vars

    return 0
}

main "$@"