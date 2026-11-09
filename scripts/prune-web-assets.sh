#!/bin/sh
# Removes everything in the web container's /usr/share/nginx/html/assets that the freshly
# deployed build does not ship.
#
# Why a manifest and not `index.html`: the bundle has chunks that index.html never names — the
# emoji index, the Tauri windows, the event bridge — and they are imported from inside the main
# script. Pruning by "what index.html mentions" therefore deleted the lazy chunks and left the app
# with 404s on first use. The manifest is the file list of the build that was just copied in.
#
#   cd client && npm run build
#   ls dist/assets > /tmp/keep.txt
#   <copy dist into the container>
#   docker cp /tmp/keep.txt harmony-web:/tmp/keep.txt
#   docker cp scripts/prune-web-assets.sh harmony-web:/tmp/prune.sh
#   docker exec harmony-web sh /tmp/prune.sh
set -eu
cd /usr/share/nginx/html
[ -f /tmp/keep.txt ] || { echo "no /tmp/keep.txt manifest, refusing to prune" >&2; exit 1; }
removed=0
for f in assets/*; do
  [ -f "$f" ] || continue
  name=${f#assets/}
  if ! grep -qxF "$name" /tmp/keep.txt; then
    echo "stale: $name"
    rm -f "$f"
    removed=$((removed + 1))
  fi
done
echo "removed $removed file(s); left:"
ls -1 assets
