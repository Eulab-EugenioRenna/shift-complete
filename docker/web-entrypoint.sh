#!/bin/sh
set -eu

cat <<EOF >/usr/share/nginx/html/runtime-config.js
window.__SHIFT_API_BASE_URL__ = "${API_BASE_URL:-/api}";
EOF

exec nginx -g 'daemon off;'
