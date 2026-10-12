#!/bin/sh
# Entrypoint for the nutrition-tracker image (metrics bind-mount ownership).
#
# Writable bind-mount targets (metrics store, optional log dir) may be owned
# by root — docker creates missing host bind paths as root:root — or by a
# host user whose uid differs from the image's bun user. Started as root, we
# fix ownership of those paths, then drop back to bun via setpriv. A start
# directly as non-root (e.g. a compose `user:` override) skips straight
# through — the app's mkdirSync + sqlite open will surface any remaining
# permission problem on stderr (metrics fail soft).

set -e

chown_if_dir() {
  case "$1" in
    /*) dir="$1" ;;
    *) dir="$PWD/$1" ;;
  esac
  if [ -d "$dir" ]; then
    chown -R "$(id -u bun):$(id -g bun)" "$dir" || true
  fi
}

if [ "$(id -u)" = "0" ]; then
  chown_if_dir "${NUTRITION_METRICS_DIR:-server/data/metrics}"
  if [ -n "${NUTRITION_METRICS_LOG_DIR:-}" ]; then
    chown_if_dir "$NUTRITION_METRICS_LOG_DIR"
  fi
  exec setpriv --reuid="$(id -u bun)" --regid="$(id -g bun)" \
    --clear-groups "$@"
fi

exec "$@"
