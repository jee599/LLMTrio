#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TRIO_DIR="$PROJECT_ROOT/.trio"
LAST_CHECK="$TRIO_DIR/last_check.json"
MODELS_JSON="$TRIO_DIR/models.json"
ROUTING_JSON="$TRIO_DIR/routing.json"
BUDGET_JSON="$TRIO_DIR/budget.json"
TODAY="$(date +%Y-%m-%d)"

mkdir -p "$TRIO_DIR"

# 1. Compare today's date with last check
if [[ -f "$LAST_CHECK" ]]; then
  last_date="$(jq -r '.last_model_check // ""' "$LAST_CHECK" 2>/dev/null || echo "")"
  if [[ "$last_date" == "$TODAY" ]]; then
    echo "Already checked today"
    exit 0
  fi
fi

# 2. Check gemini CLI
if ! command -v gemini &>/dev/null; then
  echo "Warning: gemini CLI not installed, skipping model check"
  exit 0
fi

# 3. Run gemini search
raw_result="$(gemini -p "List the latest AI coding models released in the last month. Include model name, provider, strengths, pricing (input/output per 1M tokens), and benchmarks. Output as JSON array only, no explanation." 2>/dev/null || echo "")"

# 4. Parse with jq
if ! parsed="$(echo "$raw_result" | jq '.' 2>/dev/null)"; then
  echo "Warning: Failed to parse gemini output, keeping existing models.json"
  exit 0
fi

# 5. First run vs update
if [[ ! -f "$MODELS_JSON" ]]; then
  # First run: write models.json
  tmp_models="$(mktemp "$TRIO_DIR/models.XXXXXX")"
  echo "$parsed" > "$tmp_models"
  mv "$tmp_models" "$MODELS_JSON"

  # Generate routing.json from model strengths
  tmp_routing="$(mktemp "$TRIO_DIR/routing.XXXXXX")"
  jq '{
    rules: (
      [.[] | {name, strengths}] |
      {
        architecture:   (sort_by(.strengths | tostring | test("arch|design|system"; "i") | not) | .[0].name),
        implementation: (sort_by(.strengths | tostring | test("cod|implement|engineer"; "i") | not) | .[0].name),
        testing:        (sort_by(.strengths | tostring | test("test|debug|quality"; "i") | not) | .[0].name),
        research:       (sort_by(.strengths | tostring | test("research|analy|reason"; "i") | not) | .[0].name),
        "code-review":  (sort_by(.strengths | tostring | test("review|audit|secur"; "i") | not) | .[0].name),
        documentation:  (sort_by(.strengths | tostring | test("doc|writ|explain"; "i") | not) | .[0].name)
      }
    )
  }' "$MODELS_JSON" > "$tmp_routing" 2>/dev/null && mv "$tmp_routing" "$ROUTING_JSON" || {
    rm -f "$tmp_routing"
    cp "$PROJECT_ROOT/config/default-routing.json" "$ROUTING_JSON"
  }

  # Copy default budget
  cp "$PROJECT_ROOT/config/default-budget.json" "$BUDGET_JSON"

  echo "First run initialization complete"
else
  # Compare: find new model names not in existing
  existing_names="$(jq -r '.[].name // empty' "$MODELS_JSON" 2>/dev/null || echo "")"
  new_names="$(echo "$parsed" | jq -r '.[].name // empty' 2>/dev/null || echo "")"

  added=""
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    if ! echo "$existing_names" | grep -qxF "$name"; then
      added="${added:+$added, }$name"
    fi
  done <<< "$new_names"

  if [[ -n "$added" ]]; then
    echo "New models detected: [$added]"
  fi
fi

# 6. Update last check timestamp
tmp_check="$(mktemp "$TRIO_DIR/check.XXXXXX")"
printf '{"last_model_check": "%s"}\n' "$TODAY" > "$tmp_check"
mv "$tmp_check" "$LAST_CHECK"
