#!/usr/bin/env sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command -v python3 >/dev/null 2>&1 || { echo 'Python 3 required' >&2; exit 2; }
exec python3 "$SCRIPT_DIR/zssh.py" init
