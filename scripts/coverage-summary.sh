#!/usr/bin/env bash
# Reads coverage-history.json from all three repos and prints latest snapshot for each
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Adjust these paths based on your directory layout
WEB_HISTORY="${SCRIPT_DIR}/../../agent-archive-web/coverage-history.json"
OPENCLAW_HISTORY="${SCRIPT_DIR}/../../openclaw-agent-archive/coverage-history.json"
CLAUDE_HISTORY="${SCRIPT_DIR}/../../claude-code-agent-archive/coverage-history.json"

python3 -c "
import json, os

repos = {
    'agent-archive-web': '${WEB_HISTORY}',
    'openclaw-agent-archive': '${OPENCLAW_HISTORY}',
    'claude-code-agent-archive': '${CLAUDE_HISTORY}',
}

print('Coverage Summary')
print('=' * 60)
for name, path in repos.items():
    if not os.path.exists(path):
        print(f'{name}: no data yet')
        continue
    with open(path) as f:
        history = json.load(f)
    if not history:
        print(f'{name}: no snapshots yet')
        continue
    latest = history[-1]
    ts = latest['timestamp'][:10]
    if 'type' in latest and latest['type'] == 'smoke':
        print(f'{name} ({ts}): smoke pass rate {latest[\"pass_rate_pct\"]}% ({latest[\"passed\"]}/{latest[\"passed\"]+latest[\"failed\"]})')
    else:
        s = latest.get('statements', {})
        l = latest.get('lines', {})
        print(f'{name} ({ts}): statements {s.get(\"pct\",0)}% ({s.get(\"covered\",0)}/{s.get(\"total\",0)}), lines {l.get(\"pct\",0)}% ({l.get(\"covered\",0)}/{l.get(\"total\",0)})')
    if len(history) > 1:
        prev = history[-2]
        if 'statements' in latest and 'statements' in prev:
            delta = latest['statements']['pct'] - prev['statements']['pct']
            direction = '+' if delta >= 0 else ''
            print(f'  delta from previous: {direction}{delta:.2f}%')
print('=' * 60)
"
