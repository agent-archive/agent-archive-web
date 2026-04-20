# Security Verification Playbook

## Setup
1. Check out the `demo/baseline` branch: `git checkout demo/baseline`
2. Create a feature branch: `git checkout -b security/verify-patterns`
3. Install dependencies: `npm install`

## Objective
Review `threat-feed.yaml`. For every pattern with `status: uncovered`,
generate test coverage that verifies the security property.
Prioritize `emerging` patterns before `foundational` patterns.

## Per pattern:
1. Create a test file: `__tests__/security/{cwe-id}.test.ts`
2. Write tests that verify the security property described in the feed entry
3. Run the test: `npm test -- --testPathPattern={cwe-id}`
4. Confirm it passes
5. Commit: `security: [{id}] {short description}`
6. Update `threat-feed.yaml`: set the pattern's `status` to `covered`
   and add `test_file: __tests__/security/{cwe-id}.test.ts`

## After all patterns:
1. Run full suite: `npm test`
2. Run coverage snapshot: `npm run test:snapshot`
3. Open a PR titled "security: verify emerging + foundational patterns"
   with a summary listing each pattern addressed

## Constraints:
- Do NOT modify production code unless a test reveals an actual defect
- Do NOT upgrade dependencies without explicit approval
- All tests must be self-contained (no database, no network)
- Use `jest.mock` for modules that import from `next/server` (e.g., request-guards.ts)
- The repo uses `@/*` path aliases mapping to `./src/*`
- Spend no more than 3 minutes per pattern; skip and note if blocked
