#!/usr/bin/env bash
#
# Integration test for task subdirectories, draft listing, and task status.
# Requires the dev server running at http://localhost:3000.
#
# Usage: bash tests/test-api-integration.sh
#

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0
FAILURES=()

pass() {
  ((PASS++))
  echo "  ✅ PASS  $1"
}

fail() {
  ((FAIL++))
  FAILURES+=("$1")
  echo "  ❌ FAIL  $1"
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local label="$3"
  if echo "$haystack" | grep -q "$needle"; then
    pass "$label"
  else
    fail "$label (expected to contain: $needle)"
  fi
}

assert_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [ "$actual" = "$expected" ]; then
    pass "$label"
  else
    fail "$label (expected HTTP $expected, got $actual)"
  fi
}

echo ""
echo "═══ Integration Tests: Task Dirs + Draft Listing + Status ═══"
echo ""
echo "Testing against: $BASE_URL"
echo ""

# ─── Test 1: Create a project ────────────────────────────────────────────────

echo "── 1. Create project via POST /api/projects ──"

PROJECT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project for Dir Structure",
    "description": "Integration test project",
    "instruction": "Write a hello world report"
  }')

HTTP_CODE=$(echo "$PROJECT_RESP" | tail -1)
PROJECT_BODY=$(echo "$PROJECT_RESP" | sed '$d')

assert_status "$HTTP_CODE" "201" "POST /api/projects returns 201"

PROJECT_ID=$(echo "$PROJECT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")

if [ -n "$PROJECT_ID" ]; then
  pass "Project created with id: $PROJECT_ID"
else
  fail "Could not extract project id from response"
  echo "Response: $PROJECT_BODY"
  exit 1
fi

# ─── Test 2: Verify workspace directory structure ────────────────────────────

echo ""
echo "── 2. Verify workspace directory structure ──"

WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(pwd)/workspaces}"
WS_PATH="$WORKSPACE_ROOT/$PROJECT_ID"

if [ -d "$WS_PATH" ]; then
  pass "Workspace directory exists: $WS_PATH"
else
  fail "Workspace directory not found: $WS_PATH"
fi

if [ -d "$WS_PATH/context" ]; then
  pass "context/ directory exists"
else
  fail "context/ directory not found"
fi

if [ -d "$WS_PATH/draft" ]; then
  pass "draft/ directory exists"
else
  fail "draft/ directory not found"
fi

if [ -f "$WS_PATH/CLAUDE.md" ]; then
  pass "CLAUDE.md exists at project root"
else
  fail "CLAUDE.md not found at project root"
fi

# ─── Test 3: Check if task was created and tasks/ dir exists ──────────────────

echo ""
echo "── 3. Check task creation and tasks/ directory ──"

# Wait a moment for background agent to start
sleep 2

TASKS_RESP=$(curl -s "$BASE_URL/api/tasks?projectId=$PROJECT_ID")
TASK_COUNT=$(echo "$TASKS_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$TASK_COUNT" -gt "0" ]; then
  pass "Tasks found for project: $TASK_COUNT task(s)"
else
  fail "No tasks found for project"
fi

TASK_ID=$(echo "$TASKS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null || echo "")

if [ -n "$TASK_ID" ]; then
  pass "First task id: $TASK_ID"
else
  fail "Could not extract task id"
fi

# Check if tasks/ subdirectory was created
if [ -d "$WS_PATH/tasks" ]; then
  pass "tasks/ directory exists"
else
  fail "tasks/ directory not found"
fi

if [ -n "$TASK_ID" ] && [ -d "$WS_PATH/tasks/$TASK_ID" ]; then
  pass "tasks/{taskId}/ subdirectory exists"
else
  fail "tasks/{taskId}/ subdirectory not found at $WS_PATH/tasks/$TASK_ID"
fi

# ─── Test 4: Check task CLAUDE.md exists in task dir ──────────────────────────

echo ""
echo "── 4. Verify CLAUDE.md split ──"

if [ -n "$TASK_ID" ] && [ -f "$WS_PATH/tasks/$TASK_ID/CLAUDE.md" ]; then
  pass "Task CLAUDE.md exists in tasks/{taskId}/"

  TASK_CLAUDE=$(cat "$WS_PATH/tasks/$TASK_ID/CLAUDE.md")
  if echo "$TASK_CLAUDE" | grep -q "agent"; then
    pass "Task CLAUDE.md contains agent prompt"
  else
    fail "Task CLAUDE.md missing agent prompt"
  fi
  if echo "$TASK_CLAUDE" | grep -q "ASK_USER"; then
    pass "Task CLAUDE.md contains ASK_USER format"
  else
    fail "Task CLAUDE.md missing ASK_USER format"
  fi
else
  fail "Task CLAUDE.md not found in tasks/{taskId}/"
fi

PROJECT_CLAUDE=$(cat "$WS_PATH/CLAUDE.md" 2>/dev/null || echo "")
if echo "$PROJECT_CLAUDE" | grep -q "项目"; then
  pass "Project CLAUDE.md contains project-level content"
else
  fail "Project CLAUDE.md missing project-level content"
fi

# ─── Test 5: Create a one_time task and check auto-completion ─────────────────

echo ""
echo "── 5. Create one_time task → verify auto-completion ──"

TASK2_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"name\": \"Quick one-time test\",
    \"description\": \"Say hello\",
    \"type\": \"one_time\"
  }")

HTTP_CODE2=$(echo "$TASK2_RESP" | tail -1)
TASK2_BODY=$(echo "$TASK2_RESP" | sed '$d')

assert_status "$HTTP_CODE2" "201" "POST /api/tasks returns 201"

TASK2_ID=$(echo "$TASK2_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")

if [ -n "$TASK2_ID" ]; then
  pass "One-time task created: $TASK2_ID"
else
  fail "Could not extract one_time task id"
fi

# Wait for agent to finish (poll status)
echo "  Waiting for agent to complete..."
for i in $(seq 1 30); do
  sleep 3
  STATUS=$(curl -s "$BASE_URL/api/tasks?projectId=$PROJECT_ID" | \
    python3 -c "import sys,json; tasks=json.load(sys.stdin); t=[x for x in tasks if x['id']=='$TASK2_ID']; print(t[0]['status'] if t else 'unknown')" 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "awaiting_input" ]; then
    break
  fi
  echo "  ...status=$STATUS (attempt $i/30)"
done

if [ "$STATUS" = "completed" ]; then
  pass "One-time task auto-completed to 'completed' status"
elif [ "$STATUS" = "awaiting_input" ]; then
  pass "One-time task set to 'awaiting_input' (agent asked a question - valid)"
else
  fail "One-time task status is '$STATUS' (expected 'completed' or 'awaiting_input')"
fi

# ─── Test 6: Verify task directory for the new task ──────────────────────────

echo ""
echo "── 6. Verify task dir for second task ──"

if [ -n "$TASK2_ID" ] && [ -d "$WS_PATH/tasks/$TASK2_ID" ]; then
  pass "Second task has its own tasks/{taskId}/ directory"
else
  fail "Second task directory not found"
fi

# Verify separate dirs for both tasks
if [ -n "$TASK_ID" ] && [ -n "$TASK2_ID" ] && [ "$TASK_ID" != "$TASK2_ID" ]; then
  pass "Two tasks have different task IDs (no conflict)"
fi

# ─── Test 7: Draft listing API ────────────────────────────────────────────────

echo ""
echo "── 7. Draft listing via GET /api/drafts ──"

# Create a test file in draft/
echo "Test draft content" > "$WS_PATH/draft/test-output.txt"
mkdir -p "$WS_PATH/draft/subdir"
echo "Nested draft" > "$WS_PATH/draft/subdir/nested.md"

DRAFTS_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/drafts?projectId=$PROJECT_ID")
DRAFTS_CODE=$(echo "$DRAFTS_RESP" | tail -1)
DRAFTS_BODY=$(echo "$DRAFTS_RESP" | sed '$d')

assert_status "$DRAFTS_CODE" "200" "GET /api/drafts returns 200"

DRAFT_COUNT=$(echo "$DRAFTS_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$DRAFT_COUNT" -ge "2" ]; then
  pass "Draft listing returns at least 2 files (got $DRAFT_COUNT)"
else
  fail "Draft listing returned $DRAFT_COUNT files (expected >= 2)"
fi

# Check that our test file is in the results
if echo "$DRAFTS_BODY" | python3 -c "import sys,json; files=json.load(sys.stdin); names=[f['name'] for f in files]; sys.exit(0 if 'test-output.txt' in names else 1)" 2>/dev/null; then
  pass "Draft listing includes test-output.txt"
else
  fail "Draft listing missing test-output.txt"
fi

# Check nested file
if echo "$DRAFTS_BODY" | python3 -c "import sys,json; files=json.load(sys.stdin); paths=[f['relativePath'] for f in files]; sys.exit(0 if 'subdir/nested.md' in paths else 1)" 2>/dev/null; then
  pass "Draft listing includes nested subdir/nested.md with correct relativePath"
else
  fail "Draft listing missing nested file or wrong relativePath"
fi

# ─── Test 8: Drafts API requires projectId ────────────────────────────────────

echo ""
echo "── 8. Drafts API validation ──"

NO_PID_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/drafts")
NO_PID_CODE=$(echo "$NO_PID_RESP" | tail -1)

assert_status "$NO_PID_CODE" "400" "GET /api/drafts without projectId returns 400"

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "═══ Results ═══"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo ""
  echo "  Failed tests:"
  for f in "${FAILURES[@]}"; do
    echo "    - $f"
  done
fi
echo ""

# Cleanup: remove test draft files
rm -f "$WS_PATH/draft/test-output.txt"
rm -rf "$WS_PATH/draft/subdir"

exit $FAIL
