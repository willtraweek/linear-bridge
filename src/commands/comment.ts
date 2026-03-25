import type { RunContext } from "../runner.js";
import { InputError } from "../errors.js";

interface CommentOpts {
  prefix: string;
}

interface CommentResult {
  id: string;
  issueIdentifier: string;
  body: string;
  createdAt: string;
}

export async function comment(
  ctx: RunContext,
  issueId: string,
  text: string,
  opts: CommentOpts
): Promise<CommentResult> {
  if (!text || text.trim().length === 0) {
    throw new InputError("Comment text cannot be empty.");
  }

  const issue = await ctx.client.issue(issueId);
  if (!issue) {
    throw new InputError(`Issue '${issueId}' not found.`);
  }

  const body = `${opts.prefix} ${text}`;

  const payload = await ctx.client.createComment({
    issueId: issue.id,
    body,
  });

  const created = await payload.comment;
  if (!created) {
    throw new InputError("Failed to create comment.");
  }

  return {
    id: created.id,
    issueIdentifier: issue.identifier,
    body: created.body,
    createdAt: created.createdAt.toISOString(),
  };
}
