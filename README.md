# linear-bridge

A CLI for managing Linear issues and projects, purpose-built for the [openclaw](https://github.com/willtraweek) agent system.

Wraps Linear's GraphQL API via the official `@linear/sdk`. Runs on Bun. JSON output by default for agent consumption, with `--human` for debugging.

## Setup

```bash
bun install
```

Create a `.env` file (gitignored):

```
LINEAR_API_KEY=lin_api_your_key_here
LINEAR_TEAM_KEY=JWT
```

## Issue commands

```bash
# Scan for work by workflow state
linear-bridge scan --state Todo
linear-bridge scan --state Triage

# Get full issue detail (description, comments, relations, sub-issues)
linear-bridge get ENG-42

# Move state, add/remove labels, assign to project
linear-bridge update ENG-42 --state "In Progress"
linear-bridge update ENG-42 --state Backlog --add-label "needs product decision"
linear-bridge update ENG-42 --project "Q2 Auth Rewrite"
linear-bridge update ENG-42 --remove-project

# Set estimate and priority
linear-bridge update ENG-42 --estimate 3
linear-bridge update ENG-42 --priority 2   # 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low

# Add a comment (auto-prefixed with [Engineers] by default)
linear-bridge comment ENG-42 "Clear ticket, dispatching to Coders"
linear-bridge comment ENG-42 --prefix "[Clawdius]" "Research posted"

# Create issue relations
linear-bridge relate ENG-42 ENG-38 --type blocks

# Create issues and sub-issues
linear-bridge create "Fix null check" --parent ENG-42
linear-bridge create "New feature" --state Todo --label urgent
linear-bridge create "Sized task" --estimate 5 --priority 1
```

## Project commands

```bash
# List projects for your team
linear-bridge project list

# Create a project
linear-bridge project create "Q2 Auth Rewrite" --description "Rewrite auth system"
linear-bridge project create "Sprint 5" --target-date 2026-06-30

# Get project details (description, issues, progress, health)
linear-bridge project get "Q2 Auth Rewrite"
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `LINEAR_API_KEY` | Yes | Personal API key from Linear Settings > API |
| `LINEAR_TEAM_KEY` | No | Default team key (e.g., `JWT`). Overridden by `--team` flag. |

## Exit codes

| Code | Meaning | Agent action |
|------|---------|-------------|
| 0 | Success | Process result |
| 1 | Input/validation error | Fix input, don't retry |
| 2 | Linear API unreachable | Skip, retry next heartbeat |
| 3 | Authentication failure | Escalate immediately |
| 4 | Rate limited | Wait, then retry |

## State validation

Workflow state names (Todo, Triage, In Progress, etc.) are team-configurable in Linear. The CLI discovers your team's states on first run and caches them for 24 hours in `.linear-bridge-cache.json`. Typos are caught immediately; if your team renames a state, the cache auto-refreshes.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Related projects

- [ai-orchestration](https://github.com/willtraweek/ai-orchestration) — Agent governance, ticket lifecycle
- [agent-containers](https://github.com/willtraweek/agent-containers) — Docker containers for agent execution
