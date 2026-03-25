import { IssueRelationType } from "@linear/sdk";
import type { RunContext } from "../runner.js";
import { InputError } from "../errors.js";

const VALID_TYPES = ["blocks", "duplicate", "related", "similar"] as const;

const TYPE_MAP: Record<string, IssueRelationType> = {
  blocks: IssueRelationType.Blocks,
  duplicate: IssueRelationType.Duplicate,
  related: IssueRelationType.Related,
  similar: IssueRelationType.Similar,
};

interface RelateResult {
  id: string;
  type: string;
  issueIdentifier: string;
  relatedIssueIdentifier: string;
}

export async function relate(
  ctx: RunContext,
  issueId: string,
  relatedIssueId: string,
  opts: { type: string }
): Promise<RelateResult> {
  const type = opts.type.toLowerCase();
  if (!(type in TYPE_MAP)) {
    throw new InputError(
      `Invalid relation type '${opts.type}'. Valid types: ${VALID_TYPES.join(", ")}`
    );
  }

  const issue = await ctx.client.issue(issueId);
  if (!issue) {
    throw new InputError(`Issue '${issueId}' not found.`);
  }

  const relatedIssue = await ctx.client.issue(relatedIssueId);
  if (!relatedIssue) {
    throw new InputError(`Related issue '${relatedIssueId}' not found.`);
  }

  const payload = await ctx.client.createIssueRelation({
    issueId: issue.id,
    relatedIssueId: relatedIssue.id,
    type: TYPE_MAP[type]!,
  });

  const relation = await payload.issueRelation;
  if (!relation) {
    throw new InputError("Failed to create relation.");
  }

  return {
    id: relation.id,
    type: relation.type,
    issueIdentifier: issue.identifier,
    relatedIssueIdentifier: relatedIssue.identifier,
  };
}
