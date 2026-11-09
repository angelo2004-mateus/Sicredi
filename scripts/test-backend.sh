#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

docker compose -f compose.test.yaml up -d --wait

export NODE_ENV=test
export DATABASE_URL=postgresql://test:test@localhost:55432/lixozero_test

npm --prefix api run db:generate
npm --prefix api run db:migrate

npm --prefix api run typecheck

npm --prefix api test
