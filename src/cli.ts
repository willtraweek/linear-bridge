#!/usr/bin/env bun

import { Command } from "commander";
import { runCommand } from "./runner.js";
import { scan } from "./commands/scan.js";
import { get } from "./commands/get.js";
import { update } from "./commands/update.js";
import { comment } from "./commands/comment.js";
import { relate } from "./commands/relate.js";
import { create } from "./commands/create.js";
import { projectCreate, projectGet, projectList } from "./commands/project.js";

const program = new Command();

program
  .name("linear-bridge")
  .description(
    "CLI wrapper around Linear's GraphQL API for the openclaw agent system.\n\n" +
      "Provides issue commands (scan, get, update, comment, relate, create)\n" +
      "and project commands (project create, project get, project list).\n\n" +
      "Configuration:\n" +
      "  LINEAR_API_KEY   (required) Personal API key for Linear\n" +
      "  LINEAR_TEAM_KEY  (optional) Default team key, overridden by --team flag\n\n" +
      "Exit codes:\n" +
      "  0  Success\n" +
      "  1  Input/validation error (bad args, not found)\n" +
      "  2  Linear API unreachable (network error)\n" +
      "  3  Authentication failure (bad/expired API key)\n" +
      "  4  Rate limited (retry after delay)"
  )
  .version("0.2.0")
  .option("--team <key>", "Linear team key (e.g., ENG). Overrides LINEAR_TEAM_KEY env var")
  .option("--human", "Human-readable output instead of JSON");

// ─── scan ───────────────────────────────────────────────────────────────────

program
  .command("scan")
  .description(
    "List issues by workflow state with summaries.\n\n" +
      "Returns issue ID, title, labels, relation summaries, description preview,\n" +
      "comment count, and sub-issue flag. Use 'get' for full detail.\n\n" +
      "Examples:\n" +
      "  linear-bridge scan --state Todo\n" +
      "  linear-bridge scan --state Triage --team ENG\n" +
      "  linear-bridge scan --state Todo --human"
  )
  .requiredOption("--state <name>", "Workflow state to filter by (e.g., Todo, Triage, Backlog)")
  .action(async (opts) => {
    const globalOpts = program.opts();
    await runCommand(globalOpts, (ctx) => scan(ctx, { state: opts.state }));
  });

// ─── get ────────────────────────────────────────────────────────────────────

program
  .command("get <issue-id>")
  .description(
    "Fetch a single issue with full context.\n\n" +
      "Returns full description, all comments, relations (both directions),\n" +
      "sub-issues, parent issue, labels, state, and metadata.\n\n" +
      "The <issue-id> can be the issue identifier (e.g., ENG-42) or the UUID.\n\n" +
      "Examples:\n" +
      "  linear-bridge get ENG-42\n" +
      "  linear-bridge get ENG-42 --human"
  )
  .action(async (issueId) => {
    const globalOpts = program.opts();
    await runCommand(globalOpts, (ctx) => get(ctx, issueId));
  });

// ─── update ─────────────────────────────────────────────────────────────────

program
  .command("update <issue-id>")
  .description(
    "Update an issue: move state, add/remove labels, assign to project.\n\n" +
      "At least one update flag is required. Multiple flags can be combined.\n\n" +
      "Examples:\n" +
      "  linear-bridge update ENG-42 --state 'In Progress'\n" +
      "  linear-bridge update ENG-42 --state Backlog --add-label 'needs product decision'\n" +
      "  linear-bridge update ENG-42 --remove-label urgent\n" +
      '  linear-bridge update ENG-42 --project "Q2 Auth Rewrite"\n' +
      "  linear-bridge update ENG-42 --remove-project"
  )
  .option("--state <name>", "Move issue to this workflow state")
  .option("--add-label <name>", "Add a label (repeatable)", collect, [])
  .option("--remove-label <name>", "Remove a label (repeatable)", collect, [])
  .option("--project <name-or-id>", "Assign issue to a project (by name or UUID)")
  .option("--remove-project", "Remove issue from its current project")
  .option("--estimate <number>", "Set point estimate", parseNum)
  .option("--priority <number>", "Set priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low", parseNum)
  .action(async (issueId, opts) => {
    const globalOpts = program.opts();
    await runCommand(globalOpts, (ctx) =>
      update(ctx, issueId, {
        state: opts.state,
        addLabel: opts.addLabel,
        removeLabel: opts.removeLabel,
        project: opts.project,
        removeProject: opts.removeProject,
        estimate: opts.estimate,
        priority: opts.priority,
      })
    );
  });

// ─── comment ────────────────────────────────────────────────────────────────

program
  .command("comment <issue-id> <text>")
  .description(
    "Add a comment to an issue with an automatic prefix.\n\n" +
      "By default, the comment is prefixed with '[Engineers]' for attribution.\n" +
      "Use --prefix to change the prefix for other agents.\n\n" +
      "Examples:\n" +
      '  linear-bridge comment ENG-42 "Clear ticket, moving to In Progress"\n' +
      "  # → [Engineers] Clear ticket, moving to In Progress\n\n" +
      '  linear-bridge comment ENG-42 --prefix "[Clawdius]" "Scouts research posted"\n' +
      "  # → [Clawdius] Scouts research posted"
  )
  .option("--prefix <prefix>", "Comment prefix for attribution", "[Engineers]")
  .action(async (issueId, text, opts) => {
    const globalOpts = program.opts();
    await runCommand(globalOpts, (ctx) =>
      comment(ctx, issueId, text, { prefix: opts.prefix })
    );
  });

// ─── relate ─────────────────────────────────────────────────────────────────

program
  .command("relate <issue-id> <related-issue-id>")
  .description(
    "Create a relation between two issues.\n\n" +
      "Relation types:\n" +
      "  blocks     — first issue blocks the second (Linear auto-creates inverse 'blocked by')\n" +
      "  duplicate  — first issue duplicates the second\n" +
      "  related    — loose association\n" +
      "  similar    — similar issues\n\n" +
      "Examples:\n" +
      '  linear-bridge relate ENG-42 ENG-38 --type blocks\n' +
      "  # → ENG-42 blocks ENG-38 (ENG-38 is 'blocked by' ENG-42)\n\n" +
      '  linear-bridge relate ENG-42 ENG-55 --type related'
  )
  .requiredOption(
    "--type <type>",
    "Relation type: blocks, duplicate, related, or similar"
  )
  .action(async (issueId, relatedIssueId, opts) => {
    const globalOpts = program.opts();
    await runCommand(globalOpts, (ctx) =>
      relate(ctx, issueId, relatedIssueId, { type: opts.type })
    );
  });

// ─── create ─────────────────────────────────────────────────────────────────

program
  .command("create <title>")
  .description(
    "Create a new issue or sub-issue.\n\n" +
      "Use --parent to create a sub-issue (e.g., for Codex review findings).\n" +
      "Labels and state can be set at creation time.\n\n" +
      "Examples:\n" +
      '  linear-bridge create "Fix null check in session handler"\n' +
      '  linear-bridge create "Fix null check" --parent ENG-42\n' +
      '  linear-bridge create "Add auth middleware" --state Todo --label urgent\n' +
      '  linear-bridge create "Design review needed" --description "Multiple UX approaches..."'
  )
  .option("--description <text>", "Issue description (markdown supported)")
  .option("--parent <issue-id>", "Parent issue ID to create as sub-issue")
  .option("--state <name>", "Initial workflow state")
  .option("--label <name>", "Add a label (repeatable)", collect, [])
  .option("--estimate <number>", "Set point estimate", parseNum)
  .option("--priority <number>", "Set priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low", parseNum)
  .action(async (title, opts) => {
    const globalOpts = program.opts();
    await runCommand(globalOpts, (ctx) =>
      create(ctx, title, {
        description: opts.description,
        parent: opts.parent,
        state: opts.state,
        label: opts.label,
        estimate: opts.estimate,
        priority: opts.priority,
      })
    );
  });

// ─── project (subcommand group) ─────────────────────────────────────────────

const projectCmd = program
  .command("project")
  .description("Manage Linear projects: create, get details, list.");

projectCmd
  .command("create <name>")
  .description(
    "Create a new project.\n\n" +
      "The project is created in the configured team.\n\n" +
      "Examples:\n" +
      '  linear-bridge project create "Q2 Auth Rewrite"\n' +
      '  linear-bridge project create "Sprint 5" --description "Focus on auth and onboarding"\n' +
      '  linear-bridge project create "Milestone" --target-date 2026-06-30'
  )
  .option("--description <text>", "Project description")
  .option("--target-date <YYYY-MM-DD>", "Target completion date")
  .action(async (name, opts) => {
    const globalOpts = program.opts();
    await runCommand(globalOpts, (ctx) =>
      projectCreate(ctx, name, {
        description: opts.description,
        targetDate: opts.targetDate,
      })
    );
  });

projectCmd
  .command("get <name-or-id>")
  .description(
    "Get project details including description, issues, and progress.\n\n" +
      "Accepts a project name or UUID. If multiple projects share a name,\n" +
      "you'll be asked to use the UUID instead.\n\n" +
      "Examples:\n" +
      '  linear-bridge project get "Q2 Auth Rewrite"\n' +
      "  linear-bridge project get 8a3b4c5d-1234-5678-9abc-def012345678\n" +
      '  linear-bridge project get "Sprint 5" --human'
  )
  .action(async (nameOrId) => {
    const globalOpts = program.opts();
    await runCommand(globalOpts, (ctx) => projectGet(ctx, nameOrId));
  });

projectCmd
  .command("list")
  .description(
    "List projects accessible by the configured team.\n\n" +
      "Returns project name, status, progress, issue count, and description preview.\n\n" +
      "Examples:\n" +
      "  linear-bridge project list\n" +
      "  linear-bridge project list --team ENG\n" +
      "  linear-bridge project list --human"
  )
  .action(async () => {
    const globalOpts = program.opts();
    await runCommand(globalOpts, (ctx) => projectList(ctx));
  });

// Strict numeric parser — avoids parseInt radix bug with Commander's (value, previous) signature
function parseNum(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return n;
}

// Helper for repeatable options
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

program.parse();
