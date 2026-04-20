#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="agent-archive-web"
HISTORY_FILE="coverage-history.json"
COVERAGE_FILE="coverage/coverage-summary.json"

# 1. Run tests with coverage (allow test failures — coverage is still generated)
echo "Running tests with coverage..."
npm run test:coverage -- --silent || true

# 2. Verify coverage output exists
if [ ! -f "$COVERAGE_FILE" ]; then
  echo "ERROR: $COVERAGE_FILE not found. Aborting."
  exit 1
fi

# 3. Extract totals and build snapshot
SNAPSHOT=$(node -e "
const cov = require('./$COVERAGE_FILE');
const t = cov.total;
const snapshot = {
  timestamp: new Date().toISOString(),
  repo: '$REPO_NAME',
  statements: { pct: t.statements.pct, covered: t.statements.covered, total: t.statements.total },
  branches:   { pct: t.branches.pct,   covered: t.branches.covered,   total: t.branches.total },
  functions:  { pct: t.functions.pct,   covered: t.functions.covered,  total: t.functions.total },
  lines:      { pct: t.lines.pct,       covered: t.lines.covered,      total: t.lines.total }
};
process.stdout.write(JSON.stringify(snapshot, null, 2));
")

# 4. Append to history file
if [ ! -f "$HISTORY_FILE" ]; then
  echo "[]" > "$HISTORY_FILE"
fi

node -e "
const fs = require('fs');
const history = JSON.parse(fs.readFileSync('$HISTORY_FILE', 'utf8'));
const snapshot = JSON.parse(process.argv[1]);
history.push(snapshot);
fs.writeFileSync('$HISTORY_FILE', JSON.stringify(history, null, 2) + '\n');
" "$SNAPSHOT"

# 5. Print summary
echo ""
echo "=== Coverage Snapshot ==="
echo "$SNAPSHOT"
echo ""
echo "Appended to $HISTORY_FILE ($(node -e "console.log(JSON.parse(require('fs').readFileSync('$HISTORY_FILE','utf8')).length)") entries)"
