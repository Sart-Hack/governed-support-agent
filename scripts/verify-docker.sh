#!/usr/bin/env bash
# Smoke-test the docker-compose stack. Use after `docker compose up -d`.
# Exits 0 if every service responds; non-zero with a clear failure on the first miss.
set -euo pipefail

PASS=0
FAIL=0

check() {
  local name=$1
  local cmd=$2
  printf "%-22s " "$name"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "✓"
    PASS=$((PASS + 1))
  else
    echo "✗"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== docker-compose health"
docker compose ps --format "table {{.Service}}\t{{.Status}}" || true
echo

echo "=== service smokes"
check "postgres pg_isready"  "docker compose exec -T postgres pg_isready -U \${POSTGRES_USER:-postgres}"
check "postgres has mastra"  "docker compose exec -T postgres psql -U \${POSTGRES_USER:-postgres} -lqt | cut -d '|' -f 1 | grep -qw mastra"
check "clickhouse /ping"     "curl -sf http://localhost:8123/ping"
check "redis PING"           "docker compose exec -T redis redis-cli -a \${REDIS_AUTH:-redisauth} --no-auth-warning ping | grep -q PONG"
check "minio /health/live"   "curl -sf http://localhost:9090/minio/health/live"
check "langfuse /api/public/health" "curl -sf http://localhost:3001/api/public/health"
check "bifrost root"         "curl -sf -o /dev/null -w '%{http_code}' http://localhost:8080/ | grep -qE '^(200|301|302|404)$'"

echo
echo "=== summary: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
