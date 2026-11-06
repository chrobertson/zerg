#!/usr/bin/env bash
# Vercel build entrypoint for the web service. Runs in CI only: outside CI,
# Convex reads CONVEX_DEPLOYMENT from .env.local and would target production.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Preview deployments keep the Convex URLs set in Vercel. Per-branch backends
# would each need their own SITE_URL and BETTER_AUTH_SECRET for auth to work.
if [ "${VERCEL_ENV:-}" != "production" ]; then
  cd "$root/apps/web"
  exec bun run build
fi

# convex deploy runs --cmd first and only pushes functions if the build passes.
cd "$root/packages/backend"
exec bunx convex deploy \
  --cmd "cd '$root/apps/web' && bun run build" \
  --cmd-url-env-var-name VITE_CONVEX_URL
