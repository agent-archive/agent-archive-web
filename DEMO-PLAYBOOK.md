# Demo Initiation Playbook

## Context
This is a DoD security verification demo. It showcases Devin autonomously generating
security test coverage against a threat feed for a legacy codebase (`agent-archive-web`).

The demo has two states:
- **Before**: 0/12 security patterns verified, grade F, ~1.24% test coverage, 2 CISA KEV threats unpatched (one overdue)
- **After**: 12/12 patterns verified, improved grade, higher coverage, all KEV threats addressed

The dashboard is a static HTML file at `demo/index.html` that reads from JSON files.
It is NOT part of the Next.js app — it must be served separately.

## Setup

1. Clone the repo and check out the baseline branch:
   ```bash
   git clone https://github.com/agent-archive/agent-archive-web.git
   cd agent-archive-web
   git checkout demo/baseline
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dashboard server:
   ```bash
   cd demo && python3 -m http.server 8082
   ```

4. Open the dashboard in a browser:
   - **Before state**: `http://localhost:8082/index.html?state=before`
   - **After state**: `http://localhost:8082/index.html?state=after`

## Demo Flow

### 1. Show the "Before" state
Open `http://localhost:8082/index.html?state=before` in the browser.

Walk the audience through:
- **Red status bar** at top — system is vulnerable
- **Metrics**: 0/12 patterns verified, grade F, 1.24% coverage
- **CISA KEV Threats**: 0/2 covered (amber pulsing) — these are on the federal government's
  actively-exploited list; agencies are mandated to patch them
- **Emerging Threats**: 4 cards, all red "uncovered" — note the CISA KEV badges on
  CVE-2025-29927 (critical, middleware bypass) and CVE-2024-46982 (high, cache poisoning)
  with BOD remediation due dates (one may show "OVERDUE" in red)
- **Foundational Patterns**: 8 cards, all uncovered
- **Activity Log**: Empty — no security work has been done

### 2. Kick off Devin
Start a new Devin session pointed at the `agent-archive/agent-archive-web` repo
using the **Security Verification Playbook** (`SECURITY-PLAYBOOK.md`).

Devin will:
- Read `threat-feed.yaml` (12 patterns: 4 emerging + 8 foundational)
- For each pattern: create a test file in `__tests__/security/`, run it, commit it,
  update `threat-feed.yaml` status from `uncovered` to `covered`
- Run `npm run test:snapshot` to capture final coverage
- Open a PR with all security verification tests

### 3. Show the "After" state
Once Devin finishes (or if time is tight), switch the browser to:
`http://localhost:8082/index.html?state=after`

Walk the audience through the transformation:
- **Green status bar** — system is secured
- **Metrics**: 12/12 patterns verified, grade B, coverage jumped from 1.24%
- **CISA KEV Threats**: 2/2 covered (green glow) — federal mandate met
- **Emerging Threats**: All 4 cards now green with checkmarks, linked to test files
- **Foundational Patterns**: All 8 cards green
- **Activity Log**: 12 commit messages appear with typewriter effect, each linking to the PR

### 4. Close the loop
- Click any test file link on a covered card to show the actual test code on GitHub
- Click "View PR" in the header to show Devin's PR with all commits
- Show the coverage snapshot: `cat coverage-history.json`

## Key Talking Points
- **CISA KEV**: "These aren't just CVEs — they're on CISA's actively-exploited list.
  Federal agencies are mandated to patch these. Devin prioritized them first."
- **Autonomous verification**: Devin read a threat feed, understood each vulnerability,
  wrote targeted security tests, and verified coverage — without modifying production code.
- **Traceability**: Every covered pattern links back to the specific test file and PR commit.
  Full audit trail.
- **Speed**: 12 security patterns verified in minutes, not days.

## Resetting for Another Run
To reset back to the clean baseline (all patterns uncovered):
```bash
git checkout demo/baseline
git reset --hard demo-baseline-v2
git push --force-with-lease origin demo/baseline
```

## Troubleshooting
- **Dashboard shows "Failed to load" error**: It must be served over HTTP, not `file://`.
  Run `cd demo && python3 -m http.server 8082`.
- **KEV due date not showing "OVERDUE"**: The overdue status is computed at runtime using
  the current date. Adjust `kev_due` dates in `demo/state-before.json` and
  `demo/state-after.json` relative to your demo day.
- **Coverage numbers in after state are placeholders**: After a successful Devin run,
  update `demo/state-after.json` with real numbers from `coverage-history.json`.

## File Map
| File | Purpose |
|------|---------|
| `SECURITY-PLAYBOOK.md` | Playbook Devin follows to generate security tests |
| `DEMO-PLAYBOOK.md` | This file — how to run the demo |
| `threat-feed.yaml` | 12 security patterns (4 emerging + 8 foundational) |
| `demo/index.html` | Static dashboard (dark theme, animations, CISA KEV badges) |
| `demo/state-before.json` | Dashboard data: everything uncovered |
| `demo/state-after.json` | Dashboard data: everything covered |
| `scripts/snapshot-coverage.sh` | Captures coverage snapshot to `coverage-history.json` |
| `coverage-history.json` | Timestamped coverage snapshots |
| `__tests__/security/` | Directory where Devin writes security test files |
