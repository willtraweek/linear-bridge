# linear-bridge

CLI wrapper around Linear's GraphQL API for the openclaw agent system.

## Quick start

```bash
bun install
bun run src/cli.ts --help
```

## Testing

```bash
bun test              # run all tests
bun test --watch      # watch mode
```

## Usage

Requires `LINEAR_API_KEY` env var. Team can be set via `LINEAR_TEAM_KEY` env var or `--team` flag.

```bash
LINEAR_API_KEY=lin_api_xxx bun run src/cli.ts scan --state Todo --team ENG
```

## Project structure

- `src/cli.ts` — Entry point with Commander setup
- `src/runner.ts` — Shared runCommand wrapper (DRY: init, execute, output, error)
- `src/client.ts` — LinearClient wrapper (auth, team resolution)
- `src/cache.ts` — State discovery cache (24h TTL)
- `src/errors.ts` — Error classification (exit codes 0-4)
- `src/output.ts` — JSON/human output formatting
- `src/types.ts` — Shared types and exit code constants
- `src/commands/` — One file per command (scan, get, update, comment, relate, create, project)
- `tests/` — Bun test runner, mocked LinearClient (79 tests)

## Exit codes

- 0: Success
- 1: Input/validation error
- 2: Linear API unreachable
- 3: Authentication failure
- 4: Rate limited
