import type { RunContext } from "../runner.js";
import type { IssueSummary, RelationSummary } from "../types.js";
import { validateState } from "../cache.js";

export async function scan(
  ctx: RunContext,
  opts: { state: string }
): Promise<IssueSummary[]> {
  await validateState(ctx.client, ctx.teamId, ctx.teamKey, opts.state);

  const issues = await ctx.client.issues({
    filter: {
      team: { id: { eq: ctx.teamId } },
      state: { name: { eqIgnoreCase: opts.state } },
    },
  });

  const summaries: IssueSummary[] = [];

  for (const issue of issues.nodes) {
    const labels = (await issue.labels()).nodes.map((l) => l.name);
    const relationsConn = await issue.relations();
    const relations: RelationSummary[] = [];
    for (const rel of relationsConn.nodes) {
      const relatedIssue = await rel.relatedIssue;
      if (!relatedIssue) continue;
      relations.push({
        type: rel.type,
        issueIdentifier: relatedIssue.identifier,
        issueTitle: relatedIssue.title,
      });
    }

    const inverseConn = await issue.inverseRelations();
    for (const rel of inverseConn.nodes) {
      const sourceIssue = await rel.issue;
      if (!sourceIssue) continue;
      const inverseType =
        rel.type === "blocks"
          ? "blocked_by"
          : rel.type === "duplicate"
            ? "duplicated_by"
            : rel.type;
      relations.push({
        type: inverseType,
        issueIdentifier: sourceIssue.identifier,
        issueTitle: sourceIssue.title,
      });
    }

    const children = await issue.children();
    const description = issue.description || "";

    summaries.push({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      state: opts.state,
      labels,
      relations,
      descriptionPreview:
        description.length > 200
          ? description.slice(0, 200) + "..."
          : description,
      commentCount: (await issue.comments()).nodes.length,
      hasSubIssues: children.nodes.length > 0,
      priority: issue.priority,
      assignee: (await issue.assignee)?.name || null,
    });
  }

  return summaries;
}
