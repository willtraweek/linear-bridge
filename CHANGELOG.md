# Changelog

## 0.2.0 (2026-03-24)

### New: Project management

You can now create, list, and inspect Linear projects from the CLI:

- **`project create`** — Create a project with name, description, and target date
- **`project get`** — View project details including description, issues, progress, and health status. Accepts project name or UUID.
- **`project list`** — List all projects accessible by your team with status and progress summaries

### New: Assign issues to projects

The `update` command now supports `--project` and `--remove-project` flags:

```bash
linear-bridge update ENG-42 --project "Q2 Auth Rewrite"
linear-bridge update ENG-42 --remove-project
```

Combines with existing flags — move state and assign to a project in one call:

```bash
linear-bridge update ENG-42 --state "In Progress" --project "Q2 Auth"
```

### For contributors

- Added `ProjectSummary` and `ProjectDetail` types
- `resolveProject` helper handles UUID and name-based lookup with disambiguation
- 79 tests (18 new for project commands)

---

## 0.1.0 (2026-03-24)

### Initial release

Six commands for managing the Linear ticket lifecycle:

- **`scan`** — List issues by workflow state with summaries (labels, relations, description preview)
- **`get`** — Fetch full issue detail (description, comments, relations, sub-issues, parent)
- **`update`** — Move state, add/remove labels
- **`comment`** — Add comments with automatic `[Engineers]` prefix (configurable via `--prefix`)
- **`relate`** — Create issue relations (blocks, duplicate, related, similar)
- **`create`** — Create issues and sub-issues (via `--parent`)

### Highlights

- **Cached state validation** — Workflow states discovered from Linear API with 24h TTL. Typos caught instantly; stale cache auto-refreshes.
- **Agent-friendly exit codes** — 5 distinct codes (0-4) so agents can branch on success, input error, unreachable, auth failure, or rate limit.
- **JSON by default** — Structured output for agents. `--human` flag for debugging.
- **Team scoping** — `--team` flag with `LINEAR_TEAM_KEY` env var fallback.
- **Multi-agent comments** — `--prefix` flag defaults to `[Engineers]`, configurable for other agents.

### For contributors

- TypeScript + `@linear/sdk` + Commander.js on Bun
- Shared `runCommand` wrapper for DRY error handling and output
- 61 tests with mocked LinearClient
