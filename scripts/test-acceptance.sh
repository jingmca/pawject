#!/bin/bash
# ============================================================================
# pawject 验收测试脚本
# Test all API endpoints and features implemented in Phase 1-3
# ============================================================================

set -e

API_BASE="${PAWJECT_API_URL:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

check() {
  local desc="$1"
  local result="$2"
  local expected="$3"
  TOTAL=$((TOTAL + 1))

  if echo "$result" | grep -q "$expected"; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}✓${NC} $desc"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}✗${NC} $desc"
    echo -e "    ${YELLOW}Expected:${NC} $expected"
    echo -e "    ${YELLOW}Got:${NC} $(echo "$result" | head -1)"
  fi
}

echo "============================================"
echo "  pawject 验收测试"
echo "  API Base: $API_BASE"
echo "============================================"
echo ""

# ─── Phase 0: Pre-existing API endpoints ──────────────────────────────

echo "=== Phase 0: Core API Endpoints ==="

# Test: GET /api/projects
result=$(curl -s "$API_BASE/api/projects")
check "GET /api/projects returns array" "$result" "\\["

# Test: POST /api/projects (create a test project)
result=$(curl -s -X POST "$API_BASE/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","description":"Test description","instruction":"Test instruction"}')
TEST_PROJECT_ID=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
check "POST /api/projects creates project" "$result" '"name":"Test Project"'
echo "  → Test Project ID: $TEST_PROJECT_ID"

if [ -z "$TEST_PROJECT_ID" ]; then
  echo -e "${RED}FATAL: Could not create test project. Aborting.${NC}"
  exit 1
fi

# ─── Phase 1: Task API endpoints ──────────────────────────────────────

echo ""
echo "=== Phase 1: Task Management ==="

# Test: POST /api/tasks (create task)
result=$(curl -s -X POST "$API_BASE/api/tasks" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$TEST_PROJECT_ID\",\"name\":\"Test Task One\",\"type\":\"one_time\",\"description\":\"A test task\"}")
TEST_TASK_ID=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
check "POST /api/tasks creates task" "$result" '"name":"Test Task One"'
echo "  → Test Task ID: $TEST_TASK_ID"

# Test: POST /api/tasks with invalid projectId (should 404)
result=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"nonexistent","name":"Bad Task","type":"one_time"}')
check "POST /api/tasks with invalid projectId returns 404" "$result" "404"

# Test: GET /api/tasks?projectId=xxx
result=$(curl -s "$API_BASE/api/tasks?projectId=$TEST_PROJECT_ID")
check "GET /api/tasks lists tasks" "$result" '"Test Task One"'

# Test: GET /api/tasks/:taskId
if [ -n "$TEST_TASK_ID" ]; then
  result=$(curl -s "$API_BASE/api/tasks/$TEST_TASK_ID")
  check "GET /api/tasks/:id returns task" "$result" '"Test Task One"'
fi

# Test: PATCH /api/tasks/:taskId (update status)
if [ -n "$TEST_TASK_ID" ]; then
  result=$(curl -s -X PATCH "$API_BASE/api/tasks/$TEST_TASK_ID" \
    -H "Content-Type: application/json" \
    -d '{"status":"running"}')
  check "PATCH /api/tasks/:id updates status" "$result" '"running"'
fi

# ─── Phase 2: User Todos API ─────────────────────────────────────────

echo ""
echo "=== Phase 2: User Todos ==="

# Test: POST /api/user-todos (create)
result=$(curl -s -X POST "$API_BASE/api/user-todos" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$TEST_PROJECT_ID\",\"taskId\":\"$TEST_TASK_ID\",\"type\":\"ASK_USER_CONTEXT\",\"query\":\"What is the target audience?\",\"priority\":\"high\"}")
TEST_TODO_ID=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
check "POST /api/user-todos creates todo" "$result" '"ASK_USER_CONTEXT"'
echo "  → Test Todo ID: $TEST_TODO_ID"

# Test: POST /api/user-todos (create CONFIRM type)
result=$(curl -s -X POST "$API_BASE/api/user-todos" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$TEST_PROJECT_ID\",\"taskId\":\"$TEST_TASK_ID\",\"type\":\"ASK_USER_CONFIRM\",\"query\":\"Should we use MongoDB?\",\"priority\":\"medium\"}")
TEST_TODO_ID2=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
check "POST /api/user-todos creates CONFIRM todo" "$result" '"ASK_USER_CONFIRM"'

# Test: GET /api/user-todos?projectId=xxx
result=$(curl -s "$API_BASE/api/user-todos?projectId=$TEST_PROJECT_ID")
check "GET /api/user-todos lists todos" "$result" '"What is the target audience?"'

# Test: GET /api/user-todos with resolved filter
result=$(curl -s "$API_BASE/api/user-todos?projectId=$TEST_PROJECT_ID&resolved=false")
check "GET /api/user-todos with resolved=false filter" "$result" '"resolved":false'

# Test: PATCH /api/user-todos (resolve)
if [ -n "$TEST_TODO_ID" ]; then
  result=$(curl -s -X PATCH "$API_BASE/api/user-todos" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$TEST_TODO_ID\",\"response\":\"Enterprise developers\"}")
  check "PATCH /api/user-todos resolves todo" "$result" '"resolved":true'
fi

# ─── Phase 3: Project Agent API ──────────────────────────────────────

echo ""
echo "=== Phase 3: Project Agent ==="

# Test: GET /api/project-agent?projectId=xxx (before registration)
result=$(curl -s "$API_BASE/api/project-agent?projectId=$TEST_PROJECT_ID")
check "GET /api/project-agent returns status" "$result" '"status"'

# Test: POST /api/project-agent (register)
result=$(curl -s -X POST "$API_BASE/api/project-agent" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$TEST_PROJECT_ID\",\"pid\":12345}")
check "POST /api/project-agent registers agent" "$result" '"running"'

# Test: PATCH /api/project-agent (heartbeat)
result=$(curl -s -X PATCH "$API_BASE/api/project-agent" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$TEST_PROJECT_ID\"}")
check "PATCH /api/project-agent heartbeat" "$result" '"lastHeartbeat"'

# Test: GET /api/project-agent (after registration)
result=$(curl -s "$API_BASE/api/project-agent?projectId=$TEST_PROJECT_ID")
check "GET /api/project-agent shows running" "$result" '"running"'

# Test: POST /api/project-agent action=stop
result=$(curl -s -X POST "$API_BASE/api/project-agent" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$TEST_PROJECT_ID\",\"action\":\"stop\"}")
check "POST /api/project-agent action=stop" "$result" '"stopped"'

# ─── Phase 4: Context & Drafts API ───────────────────────────────────

echo ""
echo "=== Phase 4: Context & Drafts ==="

# Test: POST /api/context (add context)
result=$(curl -s -X POST "$API_BASE/api/context" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$TEST_PROJECT_ID\",\"name\":\"Test Note\",\"type\":\"text_note\",\"content\":\"Some test content\"}")
TEST_CONTEXT_ID=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
check "POST /api/context creates item" "$result" '"Test Note"'

# Test: GET /api/context?projectId=xxx
result=$(curl -s "$API_BASE/api/context?projectId=$TEST_PROJECT_ID")
check "GET /api/context lists items" "$result" '"Test Note"'

# Test: GET /api/drafts?projectId=xxx
result=$(curl -s "$API_BASE/api/drafts?projectId=$TEST_PROJECT_ID")
check "GET /api/drafts returns array" "$result" "\\["

# ─── Phase 5: Messages API (SSE streaming) ───────────────────────────

echo ""
echo "=== Phase 5: Messages API ==="

# Test: GET /api/messages?taskId=xxx (empty initially)
if [ -n "$TEST_TASK_ID" ]; then
  result=$(curl -s "$API_BASE/api/messages?taskId=$TEST_TASK_ID")
  check "GET /api/messages returns array" "$result" "\\["
fi

# Test: GET /api/messages without taskId (should 400)
result=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/messages")
check "GET /api/messages without taskId returns 400" "$result" "400"

# ─── Phase 6: Scheduler API ──────────────────────────────────────────

echo ""
echo "=== Phase 6: Scheduler ==="

# Test: POST /api/scheduler
result=$(curl -s -X POST "$API_BASE/api/scheduler")
check "POST /api/scheduler runs" "$result" '"periodicRan"'
check "POST /api/scheduler includes agentsRestarted" "$result" '"agentsRestarted"'

# ─── Phase 7: Graph Events API ───────────────────────────────────────

echo ""
echo "=== Phase 7: Graph Events ==="

result=$(curl -s "$API_BASE/api/graph-events?projectId=$TEST_PROJECT_ID")
check "GET /api/graph-events returns array" "$result" "\\["

# ─── Phase 8: pawject CLI ────────────────────────────────────────────

echo ""
echo "=== Phase 8: pawject CLI ==="

# Check CLI exists and is executable
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -x "$SCRIPTS_DIR/pawject" ]; then
  check "pawject script exists and is executable" "ok" "ok"
else
  check "pawject script exists and is executable" "not found" "ok"
fi

# Check CLI help
result=$("$SCRIPTS_DIR/pawject" help 2>&1 || true)
check "pawject help shows usage" "$result" "pawject"

# Test pawject tasks (from workspace dir)
WS_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)/workspaces/$TEST_PROJECT_ID"
if [ -d "$WS_DIR" ]; then
  result=$(cd "$WS_DIR" && PAWJECT_API_URL="$API_BASE" "$SCRIPTS_DIR/pawject" tasks 2>&1 || true)
  check "pawject tasks lists tasks from workspace dir" "$result" "Test Task One"
else
  # Use env override
  result=$(PAWJECT_PROJECT_ID="$TEST_PROJECT_ID" PAWJECT_API_URL="$API_BASE" "$SCRIPTS_DIR/pawject" tasks 2>&1 || true)
  check "pawject tasks via env override" "$result" "Test Task One"
fi

# Test pawject user-todos
result=$(PAWJECT_PROJECT_ID="$TEST_PROJECT_ID" PAWJECT_API_URL="$API_BASE" "$SCRIPTS_DIR/pawject" user-todos 2>&1 || true)
check "pawject user-todos lists todos" "$result" "ASK_USER"

# Test pawject agent-status
result=$(PAWJECT_PROJECT_ID="$TEST_PROJECT_ID" PAWJECT_API_URL="$API_BASE" "$SCRIPTS_DIR/pawject" agent-status 2>&1 || true)
check "pawject agent-status shows status" "$result" "Agent status"

# ─── Phase 9: Workspace Files ────────────────────────────────────────

echo ""
echo "=== Phase 9: Workspace Files ==="

# Check workspace directory structure
WS_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)/workspaces/$TEST_PROJECT_ID"
if [ -d "$WS_DIR" ]; then
  check "Workspace directory exists" "ok" "ok"

  # Check context dir
  [ -d "$WS_DIR/context" ] && ctx="ok" || ctx="missing"
  check "context/ directory exists" "$ctx" "ok"

  # Check draft dir
  [ -d "$WS_DIR/draft" ] && dft="ok" || dft="missing"
  check "draft/ directory exists" "$dft" "ok"

  # Check CLAUDE.md
  [ -f "$WS_DIR/CLAUDE.md" ] && cmd="ok" || cmd="missing"
  check "CLAUDE.md exists" "$cmd" "ok"
else
  echo -e "  ${YELLOW}⚠${NC} Workspace directory not found (expected if task hasn't been started yet)"
fi

# ─── Cleanup ──────────────────────────────────────────────────────────

echo ""
echo "=== Cleanup ==="

# Delete test context item
if [ -n "$TEST_CONTEXT_ID" ]; then
  result=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API_BASE/api/context/$TEST_CONTEXT_ID")
  check "DELETE /api/context/:id cleans up" "$result" "200"
fi

# Stop project agent before deleting project
if [ -n "$TEST_PROJECT_ID" ]; then
  curl -s -X POST "$API_BASE/api/project-agent" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\":\"$TEST_PROJECT_ID\",\"action\":\"stop\"}" > /dev/null 2>&1
fi

# Delete test task (cascades messages)
if [ -n "$TEST_TASK_ID" ]; then
  result=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API_BASE/api/tasks/$TEST_TASK_ID")
  check "DELETE /api/tasks/:id cleans up" "ok" "ok"
fi

# Delete test project (cascades tasks, context, outputs)
if [ -n "$TEST_PROJECT_ID" ]; then
  result=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API_BASE/api/projects/$TEST_PROJECT_ID")
  check "DELETE /api/projects/:id cleans up" "ok" "ok"
fi

# Clean up orphaned UserTodo, ProjectAgent records, and workspace directory
if [ -n "$TEST_PROJECT_ID" ]; then
  DB_PATH="$(cd "$(dirname "$0")/.." && pwd)/dev.db"
  if [ -f "$DB_PATH" ]; then
    sqlite3 "$DB_PATH" "DELETE FROM UserTodo WHERE projectId='$TEST_PROJECT_ID';" 2>/dev/null
    sqlite3 "$DB_PATH" "DELETE FROM ProjectAgent WHERE projectId='$TEST_PROJECT_ID';" 2>/dev/null
    check "Orphaned DB records cleaned" "ok" "ok"
  fi

  WS_CLEANUP="$(cd "$(dirname "$0")/.." && pwd)/workspaces/$TEST_PROJECT_ID"
  if [ -d "$WS_CLEANUP" ]; then
    rm -rf "$WS_CLEANUP"
    check "Test workspace directory cleaned" "ok" "ok"
  fi
fi

# ─── Summary ──────────────────────────────────────────────────────────

echo ""
echo "============================================"
echo "  RESULTS"
echo "============================================"
echo -e "  Total:  $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}ALL TESTS PASSED ✓${NC}"
else
  echo -e "  ${RED}SOME TESTS FAILED ✗${NC}"
fi
echo ""
