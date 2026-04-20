#!/usr/bin/env bash
# Runs tests with coverage and appends a snapshot to coverage-history.json
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
HISTORY_FILE="${REPO_DIR}/coverage-history.json"

cd "$REPO_DIR"

# Run tests with coverage
npm run test:coverage -- --silent 2>/dev/null || true

SUMMARY="${REPO_DIR}/coverage/coverage-summary.json"
if [ ! -f "$SUMMARY" ]; then
  echo "ERROR: coverage-summary.json not found. Did tests run?"
  exit 1
fi

# Extract totals using node (already available in this repo)
SNAPSHOT=$(node -e "
const fs = require('fs');
const summary = JSON.parse(fs.readFileSync('${SUMMARY}', 'utf8'));
const totals = summary.total;
const snapshot = {
  timestamp: new Date().toISOString(),
  repo: 'agent-archive-web',
  statements: { pct: totals.statements.pct, covered: totals.statements.covered, total: totals.statements.total },
  branches:   { pct: totals.branches.pct,   covered: totals.branches.covered,   total: totals.branches.total },
  functions:  { pct: totals.functions.pct,   covered: totals.functions.covered,  total: totals.functions.total },
  lines:      { pct: totals.lines.pct,       covered: totals.lines.covered,      total: totals.lines.total },
};
console.log(JSON.stringify(snapshot));
")

# Append to history file
if [ -f "$HISTORY_FILE" ]; then
  # Read existing array, append new entry
  node -e "
    const fs = require('fs');
    const history = JSON.parse(fs.readFileSync('${HISTORY_FILE}', 'utf8'));
    history.push(${SNAPSHOT});
    fs.writeFileSync('${HISTORY_FILE}', JSON.stringify(history, null, 2) + '\n');
  "
else
  echo "[${SNAPSHOT}]" | node -e "
    const fs = require('fs');
    let buf = '';
    process.stdin.on('data', d => buf += d);
    process.stdin.on('end', () => {
      fs.writeFileSync('${HISTORY_FILE}', JSON.stringify(JSON.parse(buf), null, 2) + '\n');
    });
  "
fi

echo ""
echo "Coverage snapshot saved to coverage-history.json"
node -e "
const s = ${SNAPSHOT};
console.log('  Statements: ' + s.statements.pct + '% (' + s.statements.covered + '/' + s.statements.total + ')');
console.log('  Branches:   ' + s.branches.pct + '% (' + s.branches.covered + '/' + s.branches.total + ')');
console.log('  Functions:  ' + s.functions.pct + '% (' + s.functions.covered + '/' + s.functions.total + ')');
console.log('  Lines:      ' + s.lines.pct + '% (' + s.lines.covered + '/' + s.lines.total + ')');
"
