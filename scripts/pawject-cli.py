#!/usr/bin/env python3
"""
pawject CLI - Project agent workspace management tool.

Automatically detects projectId from CWD (assumes workspaces/{projectId}/ layout).
Uses only stdlib (urllib) to call the local pawject API.
"""

import sys
import os
import json
import urllib.request
import urllib.error
import urllib.parse
import re

API_BASE = os.environ.get("PAWJECT_API_URL", "http://localhost:3000")


def get_project_id():
    """Extract projectId from CWD path by finding the workspaces/{id} segment."""
    cwd = os.getcwd()
    match = re.search(r"workspaces/([^/]+)", cwd)
    if match:
        return match.group(1)
    # Fallback: check PAWJECT_PROJECT_ID env
    pid = os.environ.get("PAWJECT_PROJECT_ID")
    if pid:
        return pid
    print("Error: Could not determine projectId from CWD or PAWJECT_PROJECT_ID.", file=sys.stderr)
    print("Make sure you are inside a workspaces/{projectId}/ directory.", file=sys.stderr)
    sys.exit(1)


def get_task_id():
    """Extract taskId from CWD if inside tasks/{taskId}/ directory."""
    cwd = os.getcwd()
    match = re.search(r"tasks/([^/]+)", cwd)
    if match:
        return match.group(1)
    return os.environ.get("PAWJECT_TASK_ID")


def api_get(path):
    """GET request to local API."""
    url = f"{API_BASE}{path}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"API error {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}", file=sys.stderr)
        print(f"Is the pawject server running at {API_BASE}?", file=sys.stderr)
        sys.exit(1)


def api_post(path, data):
    """POST request to local API."""
    url = f"{API_BASE}{path}"
    body = json.dumps(data).encode()
    try:
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        print(f"API error {e.code}: {err_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}", file=sys.stderr)
        sys.exit(1)


def api_patch(path, data):
    """PATCH request to local API."""
    url = f"{API_BASE}{path}"
    body = json.dumps(data).encode()
    try:
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="PATCH")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        print(f"API error {e.code}: {err_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}", file=sys.stderr)
        sys.exit(1)


# ─── Read Commands ───────────────────────────────────────────────────

def cmd_tasks():
    """List all tasks for the current project."""
    project_id = get_project_id()
    tasks = api_get(f"/api/tasks?projectId={project_id}")
    if not tasks:
        print("No tasks found.")
        return
    print(f"{'ID':<28} {'Status':<16} {'Type':<12} {'Name'}")
    print("-" * 80)
    for t in tasks:
        tid = t.get("id", "")
        status = t.get("status", "")
        ttype = t.get("type", "")
        name = t.get("name", "")
        print(f"{tid:<28} {status:<16} {ttype:<12} {name}")


def cmd_task(task_id):
    """Show task details + recent messages."""
    tasks_data = api_get(f"/api/messages?taskId={task_id}")
    project_id = get_project_id()
    all_tasks = api_get(f"/api/tasks?projectId={project_id}")
    task = next((t for t in all_tasks if t["id"] == task_id), None)

    if task:
        print(f"Task: {task['name']}")
        print(f"ID:   {task['id']}")
        print(f"Type: {task['type']}  |  Status: {task['status']}")
        if task.get("description"):
            print(f"Desc: {task['description']}")
        print()

    messages = tasks_data if isinstance(tasks_data, list) else []
    recent = messages[-5:] if len(messages) > 5 else messages
    if recent:
        print(f"--- Recent messages ({len(recent)} of {len(messages)}) ---")
        for msg in recent:
            role = msg.get("role", "?")
            content = msg.get("content", "")
            preview = content[:200] + ("..." if len(content) > 200 else "")
            ts = msg.get("createdAt", "")[:19] if msg.get("createdAt") else ""
            print(f"[{role}] {ts}")
            print(f"  {preview}")
            print()
    else:
        print("No messages yet.")


def cmd_task_create(args):
    """Create a new task."""
    import argparse
    parser = argparse.ArgumentParser(prog="pawject task-create")
    parser.add_argument("--name", required=True, help="Task name")
    parser.add_argument("--type", default="one_time", choices=["one_time", "periodic", "proactive"], help="Task type")
    parser.add_argument("--desc", default="", help="Task description")
    parser.add_argument("--schedule", default=None, help="Schedule config JSON (for periodic)")
    parsed = parser.parse_args(args)

    project_id = get_project_id()
    data = {
        "projectId": project_id,
        "name": parsed.name,
        "type": parsed.type,
        "description": parsed.desc,
    }
    if parsed.schedule:
        data["scheduleConfig"] = parsed.schedule

    result = api_post("/api/tasks", data)
    print(f"Task created: {result.get('id', 'unknown')}")
    print(f"  Name:   {result.get('name', '')}")
    print(f"  Status: {result.get('status', '')}")


def cmd_task_stop(task_id):
    """Stop a running task by updating its status to completed."""
    result = api_patch(f"/api/tasks/{task_id}", {"status": "completed"})
    print(f"Task {task_id} stopped.")
    if isinstance(result, dict):
        print(f"  Status: {result.get('status', 'completed')}")


def cmd_drafts():
    """List draft files for the current project."""
    cwd = os.getcwd()
    check_paths = [
        os.path.join(cwd, "draft"),
        os.path.join(cwd, "..", "draft"),
        os.path.join(cwd, "..", "..", "draft"),
    ]
    draft_path = None
    for p in check_paths:
        rp = os.path.realpath(p)
        if os.path.isdir(rp):
            draft_path = rp
            break

    if not draft_path:
        print("No draft/ directory found.")
        return

    files = []
    for root, dirs, filenames in os.walk(draft_path):
        for f in filenames:
            if f == ".gitkeep":
                continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, draft_path)
            size = os.path.getsize(full)
            files.append((rel, size))

    if not files:
        print("No draft files.")
        return

    print(f"{'File':<50} {'Size':>10}")
    print("-" * 62)
    for name, size in sorted(files):
        print(f"{name:<50} {size:>10}")


def cmd_context():
    """List context items for the current project."""
    project_id = get_project_id()
    data = api_get(f"/api/context?projectId={project_id}")
    items = data if isinstance(data, list) else []
    if not items:
        print("No context items.")
        return

    print(f"{'ID':<28} {'Type':<12} {'Name'}")
    print("-" * 60)
    for item in items:
        cid = item.get("id", "")
        ctype = item.get("type", "")
        name = item.get("name", "")
        print(f"{cid:<28} {ctype:<12} {name}")


def cmd_todo():
    """Read TODO.md from workspace root."""
    cwd = os.getcwd()
    check_paths = [
        os.path.join(cwd, "TODO.md"),
        os.path.join(cwd, "..", "TODO.md"),
        os.path.join(cwd, "..", "..", "TODO.md"),
    ]
    for p in check_paths:
        rp = os.path.realpath(p)
        if os.path.isfile(rp):
            with open(rp, "r") as f:
                print(f.read())
            return
    print("No TODO.md found. Use 'pawject todo-add' to create one.")


def cmd_todo_add(text):
    """Append an entry to TODO.md at workspace root."""
    cwd = os.getcwd()
    check_dirs = [cwd, os.path.join(cwd, ".."), os.path.join(cwd, "..", "..")]
    ws_root = None
    for d in check_dirs:
        rd = os.path.realpath(d)
        if os.path.isfile(os.path.join(rd, "CLAUDE.md")) or os.path.isdir(os.path.join(rd, "context")):
            ws_root = rd
            break

    if not ws_root:
        ws_root = cwd

    todo_path = os.path.join(ws_root, "TODO.md")
    if not os.path.isfile(todo_path):
        with open(todo_path, "w") as f:
            f.write("# TODO\n\n")

    with open(todo_path, "a") as f:
        f.write(f"- [ ] {text}\n")

    print(f"Added to {todo_path}")


# ─── DB-Writing Skill Commands (for Agent use) ──────────────────────

def cmd_user_todos():
    """List user todos for the current project."""
    project_id = get_project_id()
    todos = api_get(f"/api/user-todos?projectId={project_id}")
    if not todos:
        print("No user todos.")
        return

    print(f"{'ID':<28} {'Type':<22} {'Priority':<10} {'Resolved':<10} {'Query'}")
    print("-" * 110)
    for t in todos:
        tid = t.get("id", "")
        ttype = t.get("type", "")
        priority = t.get("priority", "")
        resolved = "Yes" if t.get("resolved") else "No"
        query = t.get("query", "")[:50]
        print(f"{tid:<28} {ttype:<22} {priority:<10} {resolved:<10} {query}")


def cmd_user_todo_create(args):
    """Create a user todo (Agent skill: ask user for context or confirmation)."""
    import argparse
    parser = argparse.ArgumentParser(prog="pawject user-todo-create")
    parser.add_argument("--type", required=True, choices=["ASK_USER_CONTEXT", "ASK_USER_CONFIRM"], help="Todo type")
    parser.add_argument("--query", required=True, help="Question for the user")
    parser.add_argument("--task-id", default=None, help="Task ID (auto-detected from CWD if not provided)")
    parser.add_argument("--suggestion", default=None, help="Suggestion for where to add context")
    parser.add_argument("--priority", default="medium", choices=["high", "medium", "low"], help="Priority level")
    parsed = parser.parse_args(args)

    project_id = get_project_id()
    task_id = parsed.task_id or get_task_id()
    if not task_id:
        print("Error: Could not determine taskId. Use --task-id or run from tasks/{id}/ directory.", file=sys.stderr)
        sys.exit(1)

    data = {
        "projectId": project_id,
        "taskId": task_id,
        "type": parsed.type,
        "query": parsed.query,
        "suggestion": parsed.suggestion,
        "priority": parsed.priority,
    }

    result = api_post("/api/user-todos", data)
    print(f"UserTodo created: {result.get('id', 'unknown')}")
    print(f"  Type:     {result.get('type', '')}")
    print(f"  Query:    {result.get('query', '')}")
    print(f"  Priority: {result.get('priority', '')}")


def cmd_user_todo_resolve(args):
    """Resolve a user todo with a response."""
    import argparse
    parser = argparse.ArgumentParser(prog="pawject user-todo-resolve")
    parser.add_argument("--id", required=True, help="Todo ID")
    parser.add_argument("--response", default=None, help="User's response")
    parsed = parser.parse_args(args)

    data = {"id": parsed.id}
    if parsed.response:
        data["response"] = parsed.response

    result = api_patch("/api/user-todos", data)
    print(f"UserTodo resolved: {result.get('id', 'unknown')}")


def cmd_sync_task_status(args):
    """Sync task status to DB (Agent skill)."""
    import argparse
    parser = argparse.ArgumentParser(prog="pawject sync-task-status")
    parser.add_argument("--task-id", required=True, help="Task ID")
    parser.add_argument("--status", required=True, choices=["pending", "running", "completed", "awaiting_input"], help="New status")
    parsed = parser.parse_args(args)

    result = api_patch(f"/api/tasks/{parsed.task_id}", {"status": parsed.status})
    print(f"Task {parsed.task_id} status updated to: {result.get('status', '')}")


def cmd_heartbeat():
    """Send heartbeat for project agent."""
    project_id = get_project_id()
    result = api_patch("/api/project-agent", {"projectId": project_id})
    print(f"Heartbeat OK: {result.get('lastHeartbeat', '')}")


def cmd_agent_register(args):
    """Register project agent (called on startup)."""
    import argparse
    parser = argparse.ArgumentParser(prog="pawject agent-register")
    parser.add_argument("--pid", type=int, default=None, help="OS process ID")
    parser.add_argument("--session-id", default=None, help="Claude session ID")
    parsed = parser.parse_args(args)

    project_id = get_project_id()
    data = {"projectId": project_id}
    if parsed.pid:
        data["pid"] = parsed.pid
    if parsed.session_id:
        data["sessionId"] = parsed.session_id

    result = api_post("/api/project-agent", data)
    print(f"Agent registered: {result.get('id', 'unknown')}")
    print(f"  Status: {result.get('status', '')}")


def cmd_agent_status():
    """Get project agent status."""
    project_id = get_project_id()
    result = api_get(f"/api/project-agent?projectId={project_id}")
    status = result.get("status", "not_found")
    print(f"Agent status: {status}")
    if result.get("lastHeartbeat"):
        print(f"  Last heartbeat: {result['lastHeartbeat']}")
    if result.get("pid"):
        print(f"  PID: {result['pid']}")


def cmd_graph_event(args):
    """Write a graph event to DB (Agent skill for Agent View)."""
    import argparse
    parser = argparse.ArgumentParser(prog="pawject graph-event")
    parser.add_argument("--type", required=True, help="Event type (task_created, task_completed, draft_generated, context_added, ask_user)")
    parser.add_argument("--label", required=True, help="Human-readable label")
    parser.add_argument("--detail", default="", help="Detail text")
    parser.add_argument("--task-id", default=None, help="Related task ID")
    parsed = parser.parse_args(args)

    # graph-events are currently read-only from git log + DB
    # For now, just print what would be written
    print(f"Graph event: {parsed.type}")
    print(f"  Label:  {parsed.label}")
    print(f"  Detail: {parsed.detail}")
    if parsed.task_id:
        print(f"  TaskID: {parsed.task_id}")
    print("(Note: graph events are currently derived from git log + DB)")


# ─── Main ────────────────────────────────────────────────────────────

def print_usage():
    print("""pawject - Project agent workspace CLI

Reading Commands:
  pawject tasks                           List all tasks
  pawject task <id>                       Task details + recent messages
  pawject drafts                          List draft files
  pawject context                         List context items
  pawject todo                            Read TODO.md
  pawject user-todos                      List user todos from DB

Task Management:
  pawject task-create --name "x" [opts]   Create a new task
  pawject task-stop <id>                  Stop a task
  pawject todo-add "content"              Append to TODO.md

Agent Skills (DB-writing):
  pawject user-todo-create --type TYPE --query "q"   Create user todo
    --type: ASK_USER_CONTEXT | ASK_USER_CONFIRM
    --task-id: Task ID (auto-detected from CWD)
    --suggestion: Where to add context (for CONTEXT type)
    --priority: high | medium | low

  pawject user-todo-resolve --id ID [--response "r"]   Resolve a user todo
  pawject sync-task-status --task-id ID --status S      Update task status

Project Agent:
  pawject agent-register [--pid N] [--session-id S]    Register project agent
  pawject agent-status                                 Get agent status
  pawject heartbeat                                    Send agent heartbeat

Environment:
  PAWJECT_API_URL       API base URL (default: http://localhost:3000)
  PAWJECT_PROJECT_ID    Override project ID detection from CWD
  PAWJECT_TASK_ID       Override task ID detection from CWD
""")


def main():
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "tasks":
        cmd_tasks()
    elif cmd == "task" and len(sys.argv) >= 3:
        cmd_task(sys.argv[2])
    elif cmd == "task-create":
        cmd_task_create(sys.argv[2:])
    elif cmd == "task-stop" and len(sys.argv) >= 3:
        cmd_task_stop(sys.argv[2])
    elif cmd == "drafts":
        cmd_drafts()
    elif cmd == "context":
        cmd_context()
    elif cmd == "todo":
        cmd_todo()
    elif cmd == "todo-add" and len(sys.argv) >= 3:
        cmd_todo_add(" ".join(sys.argv[2:]))
    elif cmd == "user-todos":
        cmd_user_todos()
    elif cmd == "user-todo-create":
        cmd_user_todo_create(sys.argv[2:])
    elif cmd == "user-todo-resolve":
        cmd_user_todo_resolve(sys.argv[2:])
    elif cmd == "sync-task-status":
        cmd_sync_task_status(sys.argv[2:])
    elif cmd == "heartbeat":
        cmd_heartbeat()
    elif cmd == "agent-register":
        cmd_agent_register(sys.argv[2:])
    elif cmd == "agent-status":
        cmd_agent_status()
    elif cmd == "graph-event":
        cmd_graph_event(sys.argv[2:])
    elif cmd in ("-h", "--help", "help"):
        print_usage()
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        print_usage()
        sys.exit(1)


if __name__ == "__main__":
    main()
