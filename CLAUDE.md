# CLAUDE.md

## Testing workflows

Every pull request that adds or changes a GitHub workflow in `.github/workflows/` must add or update its cases under `tests/workflows/`. The `test-workflows` check runs on every pull request and a failing check blocks merging.

- Run `bun install`, then `bun test` and `actionlint` locally before pushing.
- The tests read the real workflow files: the `on:` block, the job's `if:` (evaluated with GitHub's `@actions/expressions`) and the `run:` scripts. Don't copy workflow logic into the tests.
- Stub `gh` (see `runStep` in `tests/workflows/helpers.mjs`) and never call the real agent or touch real issues.
- Labels added with `GITHUB_TOKEN` trigger nothing, so a hand-off to the next workflow must be a `workflow_dispatch`, and must be tested as one (`tests/workflows/chain.test.mjs`).
- Show a new check can fail by temporarily breaking the thing it covers (for example a wrong label name) before relying on it.
