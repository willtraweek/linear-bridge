import type { RunContext } from "../runner.js";
import type { IssueDetail, RelationSummary, CommentDetail, IssueSummary } from "../types.js";
import { InputError } from "../errors.js";

export async function get(
  ctx: RunContext,
  issueId: string
): Promise<IssueDetail> {
  const issue = await ctx.client.issue(issueId);
  if (!issue) {
    throw new InputError(`Issue '${issueId}' not found.`);
  }

  const state = await issue.state;
  const labels = (await issue.labels()).nodes.map((l) => l.name);

  // Relations (outgoing)
  const relations: RelationSummary[] = [];
  const relationsConn = await issue.relations();
  for (const rel of relationsConn.nodes) {
    const relatedIssue = await rel.relatedIssue;
    if (!relatedIssue) continue;
    relations.push({
      type: rel.type,
      issueIdentifier: relatedIssue.identifier,
      issueTitle: relatedIssue.title,
    });
  }

  // Inverse relations (incoming)
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

  // Comments
  const commentsConn = await issue.comments();
  const comments: CommentDetail[] = [];
  for (const c of commentsConn.nodes) {
    const user = await c.user;
    comments.push({
      id: c.id,
      body: c.body,
      user: user?.name || "Unknown",
      createdAt: c.createdAt.toISOString(),
    });
  }

  // Children
  const childrenConn = await issue.children();
  const children: IssueSummary[] = [];
  for (const child of childrenConn.nodes) {
    const childState = await child.state;
    const childLabels = (await child.labels()).nodes.map((l) => l.name);
    children.push({
      id: child.id,
      identifier: child.identifier,
      title: child.title,
      state: childState?.name || "Unknown",
      labels: childLabels,
      relations: [],
      descriptionPreview: (child.description || "").slice(0, 200),
      commentCount: 0,
      hasSubIssues: false,
      priority: child.priority,
      estimate: child.estimate,
      assignee: (await child.assignee)?.name || null,
    });
  }

  // Parent
  const parentIssue = await issue.parent;
  const parent = parentIssue
    ? {
        id: parentIssue.id,
        identifier: parentIssue.identifier,
        title: parentIssue.title,
      }
    : null;

  const description = issue.description || "";

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    state: state?.name || "Unknown",
    labels,
    relations,
    descriptionPreview:
      description.length > 200
        ? description.slice(0, 200) + "..."
        : description,
    description,
    commentCount: comments.length,
    hasSubIssues: children.length > 0,
    priority: issue.priority,
    estimate: issue.estimate,
    assignee: (await issue.assignee)?.name || null,
    comments,
    children,
    parent,
    url: issue.url,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  };
}
