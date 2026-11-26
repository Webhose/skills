#!/usr/bin/env bash
# Releases main as vX.Y.Z, then starts what follows a release: the docs.webz.io sync and the job that
# pins the new skills in the Webz.io plugin. mcp.webz.io picks up a new release by itself.
# Uses your own GitHub login (gh auth login); no token is stored anywhere.
#   scripts/release.sh 1.2.0
set -euo pipefail
cd "$(dirname "$0")/.."

[[ "${1:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Usage: $0 X.Y.Z" >&2; exit 2; }
tag="v$1"

git fetch --quiet --tags origin main
if [ -n "$(git status --porcelain)" ] || [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "Release from a clean checkout of origin/main." >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "$tag already exists." >&2
  exit 1
fi

node --test scripts/skills.test.mjs
node scripts/skills.mjs check

git tag "$tag"
git push origin "$tag"

echo "Waiting for the Release workflow to publish $tag..."
published=""
for _ in $(seq 60); do
  if gh release view "$tag" --repo Webhose/skills --json assets -q '.assets[].name' 2>/dev/null | grep -qx skills.json; then
    published=yes
    break
  fi
  sleep 5
done
[ -n "$published" ] || { echo "$tag is pushed but not published after 5 minutes. Re-run its Release job: https://github.com/Webhose/skills/actions" >&2; exit 1; }

started=yes
gh workflow run skills-sync.yml --repo Webhose/docs || started=""
gh workflow run skills.yml --repo Webhose/webz-mcp-plugin -f tag="$tag" || started=""
[ -n "$started" ] || { echo "$tag is released, but a follow-up job did not start. Start it by hand: see Releases in README.md." >&2; exit 1; }
echo "$tag is released. The docs sync and the plugin job are running."
