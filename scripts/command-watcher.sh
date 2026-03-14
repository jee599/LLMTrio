#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TRIO_DIR="$PROJECT_ROOT/.trio"
PENDING="$TRIO_DIR/commands/pending.json"
PID_FILE="$TRIO_DIR/pids/command-watcher.pid"
STATE="$TRIO_DIR/state.json"
VALID_TARGETS="claude codex gemini"

# Load API keys from .trio/.env if exists
if [[ -f "$TRIO_DIR/.env" ]]; then
  set -a; source "$TRIO_DIR/.env"; set +a
fi

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

cleanup() {
  log "Shutting down command-watcher"
  rm -f "$PID_FILE"
  exit 0
}
trap 'cleanup' TERM INT EXIT

mkdir -p "$TRIO_DIR/pids" "$TRIO_DIR/commands"
echo $$ > "$PID_FILE"
log "command-watcher started (PID $$)"

send_prompt() {
  local target="$1" content="$2"
  case "$target" in
    claude) claude -p "$content" ;;
    codex)  codex exec "$content" ;;
    gemini) gemini -p "$content" ;;
    *) log "ERROR: unknown target '$target'" ; return 1 ;;
  esac
}

validate_target() {
  local target="$1"
  for t in $VALID_TARGETS; do
    [[ "$t" == "$target" ]] && return 0
  done
  log "ERROR: invalid target '$target'"
  return 1
}

process_command() {
  local type target content branch
  type=$(echo "$1" | jq -r '.type // empty')
  target=$(echo "$1" | jq -r '.target // empty')
  content=$(echo "$1" | jq -r '.content // empty')
  branch=$(echo "$1" | jq -r '.branch // empty')

  log "Processing command: type=$type target=$target"

  case "$type" in
    prompt)
      # Skip workflow prompts — handled by dashboard-server → octopus-core
      local is_workflow
      is_workflow=$(echo "$1" | jq -r '.workflow // false')
      if [[ "$is_workflow" == "true" ]]; then
        log "Skipping workflow prompt (handled by octopus-core)"
      else
        validate_target "$target" && send_prompt "$target" "$content"
      fi
      ;;
    pause)
      validate_target "$target" && pkill -STOP -f "$target" && log "Paused $target"
      ;;
    cancel)
      validate_target "$target" && pkill -f "$target" && \
        jq --arg t "$target" '.tasks = [.tasks[] | if .agent == $t then .status = "cancelled" else . end]' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE" && \
        log "Cancelled $target"
      ;;
    approve)
      jq --arg t "$target" '.tasks = [.tasks[] | if .agent == $t then .status = "approved" else . end]' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
      log "Approved task for $target"
      ;;
    reject)
      jq --arg t "$target" '.tasks = [.tasks[] | if .agent == $t then .status = "rejected" else . end]' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
      log "Rejected task for $target"
      ;;
    reassign)
      local new_agent
      new_agent=$(echo "$1" | jq -r '.new_agent // empty')
      validate_target "$new_agent" && \
        jq --arg t "$target" --arg n "$new_agent" '.tasks = [.tasks[] | if .agent == $t then .agent = $n else . end]' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
      log "Reassigned $target -> $new_agent"
      ;;
    update-routing)
      echo "$content" | jq '.' > "$TRIO_DIR/routing.json.tmp" && mv "$TRIO_DIR/routing.json.tmp" "$TRIO_DIR/routing.json"
      log "Updated routing rules"
      ;;
    update-budget)
      echo "$content" | jq '.' > "$TRIO_DIR/budget.json.tmp" && mv "$TRIO_DIR/budget.json.tmp" "$TRIO_DIR/budget.json"
      log "Updated budget"
      ;;
    debate-input)
      mkdir -p "$TRIO_DIR/debates"
      echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"input\":$(echo "$content" | jq -Rs '.')}" >> "$TRIO_DIR/debates/log.jsonl"
      log "Appended debate input"
      ;;
    merge)
      git -C "$PROJECT_ROOT" merge "$branch" && log "Merged branch $branch" || log "ERROR: merge failed for $branch"
      ;;
    *)
      log "ERROR: unknown command type '$type'"
      ;;
  esac
}

while true; do
  if [[ -f "$PENDING" ]] && [[ -s "$PENDING" ]]; then
    count=$(jq 'length' "$PENDING" 2>/dev/null || echo 0)
    if [[ "$count" -gt 0 ]]; then
      log "Found $count command(s)"
      for i in $(seq 0 $((count - 1))); do
        cmd=$(jq ".[$i]" "$PENDING")
        process_command "$cmd"
      done
      echo '[]' > "$PENDING.tmp" && mv "$PENDING.tmp" "$PENDING"
      log "Cleared pending commands"
    fi
  fi
  sleep 2
done
