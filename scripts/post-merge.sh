#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

pnpm --filter @workspace/scripts run sync-github || echo "WARNING: GitHub sync failed — continuing anyway."
