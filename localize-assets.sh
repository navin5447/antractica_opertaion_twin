#!/usr/bin/env bash
set -Eeuo pipefail

# Download Manus/WebDev storage assets into client/public/assets and rewrite
# references from /manus-storage/... to local /assets/... paths.
# Usage:
#   ./scripts/localize-assets.sh https://your-webdev-preview.example.com
# Optional:
#   LOCALIZE_SKIP_REWRITE=1 ./scripts/localize-assets.sh <preview-url>

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BASE_URL="${1:-${WEBDEV_PREVIEW_URL:-}}"
BASE_URL="${BASE_URL%/}"
ASSET_DIR="$PROJECT_ROOT/client/public/assets"

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <webdev-preview-url>" >&2
  echo "Example: $0 https://3000-your-preview.manus.computer" >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but was not found." >&2
  exit 1
fi

mkdir -p "$ASSET_DIR"

# storage key -> local filename
assets=(
  "antarctica-ops-hero_5a76e825.jpg|antarctica-ops-hero.jpg"
  "maitri-station_cbaab1d2.jpg|maitri-station.jpg"
  "bharati-station_9dd8bbaf.jpg|bharati-station.jpg"
)

for entry in "${assets[@]}"; do
  storage_key="${entry%%|*}"
  local_name="${entry##*|}"
  destination="$ASSET_DIR/$local_name"
  echo "Downloading $storage_key -> client/public/assets/$local_name"
  curl --fail --location --show-error --silent \
    --retry 3 --retry-delay 2 --connect-timeout 15 --max-time 180 \
    "$BASE_URL/manus-storage/$storage_key" \
    --output "$destination"
  test -s "$destination"
done

if [[ "${LOCALIZE_SKIP_REWRITE:-0}" != "1" ]]; then
  echo "Rewriting frontend references to local asset paths"
  find "$PROJECT_ROOT/client/src" -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' -o -name '*.html' \) -print0 |
    while IFS= read -r -d '' file; do
      sed -i \
        -e 's|/manus-storage/antarctica-ops-hero_5a76e825\.jpg|/assets/antarctica-ops-hero.jpg|g' \
        -e 's|/manus-storage/maitri-station_cbaab1d2\.jpg|/assets/maitri-station.jpg|g' \
        -e 's|/manus-storage/bharati-station_9dd8bbaf\.jpg|/assets/bharati-station.jpg|g' \
        "$file"
    done
fi

echo
echo "Local assets are ready in: $ASSET_DIR"
echo "Run the app with: pnpm dev"
