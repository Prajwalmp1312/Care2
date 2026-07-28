#!/usr/bin/env sh
set -eu

python -m compileall -q services/careconnect
find services/meal-planner/src -name '*.js' -exec node --check {} \;
(
  cd apps/web
  npm ci
  npm run build
)

echo "All syntax and frontend production-build checks passed."
