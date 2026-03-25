import type { RunContext } from "../runner.js";
import { InputError } from "../errors.js";
import { validateState } from "../cache.js";
import { resolveProject } from "./project.js";

interface UpdateOpts {
  state?: string;
  addLabel?: string[];
  removeLabel?: string[];
  project?: string;
  removeProject?: boolean;
  estimate?: number;
  priority?: number;
}

interface UpdateResult {
  id: string;
  identifier: string;
  title: string;
  state: string;
  labels: string[];
  estimate: number | null;
  priority: number;
}

export async function update(
  ctx: RunContext,
  issueId: string,
  opts: UpdateOpts
): Promise<UpdateResult> {
  if (!opts.state && !opts.addLabel?.length && !opts.removeLabel?.length && !opts.project && !opts.removeProject && opts.estimate === undefined && opts.priority === undefined) {
    throw new InputError(
      "At least one update flag required: --state, --add-label, --remove-label, --project, --remove-project, --estimate, or --priority"
    );
  }

  const issue = await ctx.client.issue(issueId);
  if (!issue) {
    throw new InputError(`Issue '${issueId}' not found.`);
  }

  // Move state if requested
  if (opts.state) {
    await validateState(ctx.client, ctx.teamId, ctx.teamKey, opts.state);

    const team = await ctx.client.team(ctx.teamId);
    const statesConn = await team.states();
    const targetState = statesConn.nodes.find(
      (s) => s.name.toLowerCase() === opts.state!.toLowerCase()
    );
    if (targetState) {
      await ctx.client.updateIssue(issue.id, { stateId: targetState.id });
    }
  }

  // Add labels
  if (opts.addLabel?.length) {
    const team = await ctx.client.team(ctx.teamId);
    const teamLabels = await team.labels();
    // Also check workspace-level labels
    const wsLabels = await ctx.client.issueLabels();

    for (const labelName of opts.addLabel) {
      const label =
        teamLabels.nodes.find(
          (l) => l.name.toLowerCase() === labelName.toLowerCase()
        ) ||
        wsLabels.nodes.find(
          (l) => l.name.toLowerCase() === labelName.toLowerCase()
        );
      if (!label) {
        throw new InputError(
          `Label '${labelName}' not found in team ${ctx.teamKey} or workspace.`
        );
      }
      const currentLabels = (await issue.labels()).nodes.map((l) => l.id);
      if (!currentLabels.includes(label.id)) {
        await ctx.client.updateIssue(issue.id, {
          labelIds: [...currentLabels, label.id],
        });
      }
    }
  }

  // Remove labels
  if (opts.removeLabel?.length) {
    const currentLabels = (await issue.labels()).nodes;
    for (const labelName of opts.removeLabel) {
      const label = currentLabels.find(
        (l) => l.name.toLowerCase() === labelName.toLowerCase()
      );
      if (label) {
        const remaining = currentLabels
          .filter((l) => l.id !== label.id)
          .map((l) => l.id);
        await ctx.client.updateIssue(issue.id, { labelIds: remaining });
      }
    }
  }

  // Set project
  if (opts.project) {
    const resolved = await resolveProject(ctx.client, opts.project);
    await ctx.client.updateIssue(issue.id, { projectId: resolved.id });
  }

  // Remove from project
  if (opts.removeProject) {
    await ctx.client.updateIssue(issue.id, { projectId: null });
  }

  // Set estimate
  if (opts.estimate !== undefined) {
    await ctx.client.updateIssue(issue.id, { estimate: opts.estimate });
  }

  // Set priority
  if (opts.priority !== undefined) {
    await ctx.client.updateIssue(issue.id, { priority: opts.priority });
  }

  // Re-fetch for response
  const updated = await ctx.client.issue(issueId);
  const updatedState = await updated.state;
  const updatedLabels = (await updated.labels()).nodes.map((l) => l.name);

  return {
    id: updated.id,
    identifier: updated.identifier,
    title: updated.title,
    state: updatedState?.name || "Unknown",
    labels: updatedLabels,
    estimate: updated.estimate,
    priority: updated.priority,
  };
}
