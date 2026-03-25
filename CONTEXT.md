# Linear Bridge — Context Dump

This document captures the full context behind this project so the next Claude Code session can pick up where we left off.

## What this is

A custom wrapper around Linear's GraphQL API, purpose-built for the openclaw agent system. It bridges Engineers (and Clawdius) to Linear so the ticket lifecycle defined in `ai-orchestration/engineers/ticket-lifecycle.md` becomes executable.

## Why not the official Linear MCP server?

The official MCP server (`https://mcp.linear.app/sse`) supports find/create/update on issues, projects, and comments. But:

1. **Issue relations are uncertain.** The GraphQL API has `issueRelationCreate` with types `blocks`, `duplicate`, `related`, `similar` — but it's unclear whether the MCP server exposes this. The `blocked by` / `blocking` workflow in ticket-lifecycle.md depends on relations.
2. **Sub-issues use a different mechanism.** Parent/child is a field on Issue (`parentId`), not a relation type. Engineers needs to create sub-issues from Codex review findings.
3. **The agent needs specific compound operations.** "Scan Todo for clear tickets" isn't one API call — it's a filtered search + read issue details + check relations + classify. A wrapper can expose this as a single tool.
4. **Comment conventions.** Every Engineers comment must be prefixed with `[Engineers]`. The wrapper can enforce this.

## What Engineers needs from Linear (from ticket-lifecycle.md)

### Read operations
- **Scan Todo/Triage** — list issues in these states, with labels, relations, and enough context to classify readiness
- **Read issue details** — full description, comments, relations (`blocked by`), labels, parent/children
- **Check blocked status** — is this issue blocked by another issue? Is the blocker resolved?

### Write operations
- **Move issue state** — Todo → In Progress, In Progress → In Review, In Review → Done, Done → Live
- **Move back to Backlog** — with classification label (`requires engineering review`, `requires design review`, `needs product decision`)
- **Add `[Engineers]` comment** — always prefixed, explaining the classification or action taken
- **Create issue relation** — `blocks` type (Linear auto-creates the inverse `blocked by`)
- **Create sub-issue** — new issue with `parentId` set to the original ticket (for Codex review findings)
- **Add/remove labels** — classification labels, `urgent` label for ASAP tickets bounced to Backlog
- **Create issue** — for follow-up tickets spawned from Codex review

### Clawdius also needs
- **Read access** — to understand the backlog and what Engineers is working on
- **Possibly route research** — Scouts results posted as comments on relevant tickets

## Linear GraphQL API — Key schema details

### Issue Relations
```graphql
enum IssueRelationType {
  blocks       # creates inverse "blocked by" automatically
  duplicate
  related
  similar
}

mutation {
  issueRelationCreate(input: {
    issueId: "LIN-123"        # the blocking issue
    relatedIssueId: "LIN-456" # the blocked issue
    type: blocks
  }) { ... }
}
```

Note: no `sub_issue` relation type. Parent/child is via `parentId` on the Issue itself.

### Issue Relations — Read
```graphql
type IssueRelation {
  id: ID!
  issue: Issue!          # the issue whose relationship is described
  relatedIssue: Issue!   # the other issue
  type: String!          # "blocks", "duplicate", "related", "similar"
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Authentication
- OAuth 2.0 or personal API key
- API endpoint: `https://api.linear.app/graphql`
- Header: `Authorization: Bearer <token>`

### Agent-specific OAuth scopes (if using OAuth)
- `app:assignable` — agent can be assigned to issues
- `app:mentionable` — agent can be @mentioned
- Standard read/write scopes for issues, comments, labels

For v1, a personal API key is simpler. OAuth if/when this becomes a shared tool.

## Architecture decision (resolved)

**Chosen: CLI tool** (Option B) — TypeScript + `@linear/sdk` + Commander.js, running on Bun.

The official Linear TypeScript SDK provides typed models, pagination, and auth handling. Bun runs TypeScript natively — no compilation needed for development. MCP wrapper was considered and deferred; agents call CLI via shell just as effectively.

### Implementation details
- **6 commands:** `scan`, `get`, `update`, `comment`, `relate`, `create`
- **Config:** `LINEAR_API_KEY` env var (required), `--team` flag / `LINEAR_TEAM_KEY` env var for team scoping
- **Output:** JSON by default, `--human` flag for debugging
- **Exit codes:** 0 (success), 1 (input error), 2 (unreachable), 3 (auth failure), 4 (rate limited)
- **State validation:** Workflow states are discovered from Linear API and cached for 24h (`.linear-bridge-cache.json`). Typos are caught; stale cache auto-refreshes.
- **Comment prefix:** `--prefix` flag with `[Engineers]` default. Clawdius can use `--prefix "[Clawdius]"`.

### Command examples
```bash
# Scan for work (heartbeat scan)
bun run src/cli.ts scan --state Todo --team ENG

# Get full issue detail
bun run src/cli.ts get ENG-42

# Move to In Progress + comment
bun run src/cli.ts update ENG-42 --state "In Progress"
bun run src/cli.ts comment ENG-42 "Clear ticket, dispatching to Coders"

# Bounce to Backlog with label
bun run src/cli.ts update ENG-42 --state Backlog --add-label "needs product decision"
bun run src/cli.ts comment ENG-42 "Scope ambiguous — what's in vs out?"

# Create sub-issue from Codex review
bun run src/cli.ts create "Fix null check" --parent ENG-42

# Create blocking relation
bun run src/cli.ts relate ENG-42 ENG-38 --type blocks
```

## The ticket lifecycle it must support

From `ai-orchestration/engineers/ticket-lifecycle.md`:

```
Backlog → Todo (Overseer moves when fleshed out)
Todo → In Progress (Engineers dispatches to Coders)
Todo → Backlog (Engineers needs input, adds label + comment)
In Progress → In Review (Coders complete, Engineers reviews)
In Review → Done (merged to dev)
Done → Live (merged to master)

Triage → In Progress (ASAP, fast-tracked)
Triage → Backlog (ASAP but needs input, add urgent + classification label)
```

Labels applied by Engineers when bouncing to Backlog:
- `requires engineering review`
- `requires design review`
- `needs product decision`
- `urgent` (preserved on ASAP tickets that need input)

Comment convention: all Engineers activity prefixed with `[Engineers]`.

Issue relations:
- `blocked by` / `blocking` — for dependency tracking (tickets stay in Todo, not Backlog)
- `parent of` / `sub-issue of` — for decomposition and Codex review findings

## Related repos

- `ai-orchestration` — governance doctrine, agent workspace files, ticket-lifecycle.md
- `agent-containers` — Docker containers for agent execution, staged runner
- `clawdius-newspaper` — first test project (overnight run proof of concept)

## Conversation context

This project emerged from a conversation about:
1. Whether to use Linear vs GitHub Issues for cross-repo ticketing
2. How to wire the openclaw agent system to a task queue
3. Analysis of the first overnight agent run (clawdius-newspaper PRs #6-10)
4. The realization that Engineers already has a complete Linear lifecycle designed but no way to actually read/write Linear

The first overnight run revealed a coordination failure — Clawdius spawned 4 independent Engineers sessions instead of 1, causing a cross-cutting rename bug. The fix (one Engineers per repo rule) has been added to Clawdius TOOLS.md. The ticket lifecycle + Linear bridge is the next step toward making the system actually work as designed.
