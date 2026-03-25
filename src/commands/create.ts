import type { RunContext } from "../runner.js";
import { InputError } from "../errors.js";
import { validateState } from "../cache.js";

interface CreateOpts {
  description?: string;
  parent?: string;
  state?: string;
  label?: string[];
  estimate?: number;
  priority?: number;
}

interface CreateResult {
  id: string;
  identifier: string;
  title: string;
  state: string;
  parent: string | null;
  url: string;
  estimate: number | null;
  priority: number;
}

export async function create(
  ctx: RunContext,
  title: string,
  opts: CreateOpts
): Promise<CreateResult> {
  if (!title || title.trim().length === 0) {
    throw new InputError("Issue title is required.");
  }

  let parentId: string | undefined;
  if (opts.parent) {
    const parentIssue = await ctx.client.issue(opts.parent);
    if (!parentIssue) {
      throw new InputError(`Parent issue '${opts.parent}' not found.`);
    }
    parentId = parentIssue.id;
  }

  let stateId: string | undefined;
  if (opts.state) {
    await validateState(ctx.client, ctx.teamId, ctx.teamKey, opts.state);

    const team = await ctx.client.team(ctx.teamId);
    const statesConn = await team.states();
    const targetState = statesConn.nodes.find(
      (s) => s.name.toLowerCase() === opts.state!.toLowerCase()
    );
    if (targetState) {
      stateId = targetState.id;
    }
  }

  let labelIds: string[] | undefined;
  if (opts.label?.length) {
    const team = await ctx.client.team(ctx.teamId);
    const teamLabels = await team.labels();
    const wsLabels = await ctx.client.issueLabels();
    labelIds = [];

    for (const labelName of opts.label) {
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
      labelIds.push(label.id);
    }
  }

  const payload = await ctx.client.createIssue({
    title: title.trim(),
    teamId: ctx.teamId,
    description: opts.description,
    parentId,
    stateId,
    labelIds,
    estimate: opts.estimate,
    priority: opts.priority,
  });
  const created = await payload.issue;
  if (!created) {
    throw new InputError("Failed to create issue.");
  }

  const createdState = await created.state;
  const parentIssue = opts.parent ? await ctx.client.issue(opts.parent) : null;

  return {
    id: created.id,
    identifier: created.identifier,
    title: created.title,
    state: createdState?.name || "Unknown",
    parent: parentIssue?.identifier || null,
    url: created.url,
    estimate: created.estimate,
    priority: created.priority,
  };
}
