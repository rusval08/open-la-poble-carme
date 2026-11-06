#!/bin/sh
set -eu
DATA_DIR="${DATA_DIR:-/data}"
case "$DATA_DIR" in
  /data|/var/data|/app|/app/data) ;;
  *) echo "CPool: ruta de dades no admesa" >&2; exit 1 ;;
esac
export DATA_DIR
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown node:node "$DATA_DIR"
  exec su-exec node "$@"
fi
exec "$@"
