import { describe, expect, test } from "bun:test";
import { comment } from "../../src/commands/comment.js";
import { InputError } from "../../src/errors.js";
import type { RunContext } from "../../src/runner.js";

function makeMockCtx(issueExists = true): RunContext {
  return {
    client: {
      issue: () => {
        if (!issueExists) throw new Error("Entity not found");
        return Promise.resolve({
          id: "uuid-1",
          identifier: "ENG-42",
        });
      },
      createComment: (input: { issueId: string; body: string }) =>
        Promise.resolve({
          comment: Promise.resolve({
            id: "comment-1",
            body: input.body,
            createdAt: new Date("2026-03-24"),
          }),
        }),
    } as never,
    teamId: "team-1",
    teamKey: "ENG",
  };
}

describe("comment command", () => {
  test("creates comment with default [Engineers] prefix", async () => {
    const ctx = makeMockCtx();
    const result = await comment(ctx, "ENG-42", "Clear ticket", {
      prefix: "[Engineers]",
    });
    expect(result.body).toBe("[Engineers] Clear ticket");
    expect(result.issueIdentifier).toBe("ENG-42");
  });

  test("creates comment with custom prefix", async () => {
    const ctx = makeMockCtx();
    const result = await comment(ctx, "ENG-42", "Research posted", {
      prefix: "[Clawdius]",
    });
    expect(result.body).toBe("[Clawdius] Research posted");
  });

  test("throws on empty text", async () => {
    const ctx = makeMockCtx();
    expect(
      comment(ctx, "ENG-42", "", { prefix: "[Engineers]" })
    ).rejects.toThrow(InputError);
  });

  test("throws on whitespace-only text", async () => {
    const ctx = makeMockCtx();
    expect(
      comment(ctx, "ENG-42", "   ", { prefix: "[Engineers]" })
    ).rejects.toThrow(InputError);
  });

  test("throws when issue not found", async () => {
    const ctx = makeMockCtx(false);
    expect(
      comment(ctx, "ENG-999", "test", { prefix: "[Engineers]" })
    ).rejects.toThrow();
  });
});
