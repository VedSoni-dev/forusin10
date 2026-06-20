#!/bin/sh
set -e
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
chmod +x "$DIR/fui"
mkdir -p /usr/local/bin
ln -sf "$DIR/fui" /usr/local/bin/fui
echo "Installed fui at /usr/local/bin/fui"
