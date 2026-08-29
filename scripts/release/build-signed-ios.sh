#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
manifest="$repo_root/release/manifest.json"

profile_item=$(jq -r '.apple.profile_item_id // empty' "$manifest")
if [[ -z "$profile_item" ]]; then
  echo "Track iOS signed build is blocked: no Track App Store provisioning profile is stored in 1Password." >&2
  exit 2
fi

echo "Track iOS signing recovery is not configured for the profile $profile_item." >&2
exit 2
