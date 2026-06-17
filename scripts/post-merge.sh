#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

if [ -n "$GITHUB_PAT" ]; then
  ENCODED=$(printf "x-access-token:%s" "$GITHUB_PAT" | base64 | tr -d '\n')
  git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic ${ENCODED}" \
    push origin HEAD:main
  echo "Synced to GitHub successfully."
else
  echo "WARNING: GITHUB_PAT not set — skipping GitHub sync."
fi
