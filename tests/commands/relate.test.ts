import { describe, expect, test } from "bun:test";
import { relate } from "../../src/commands/relate.js";
import { InputError } from "../../src/errors.js";
import type { RunContext } from "../../src/runner.js";

function makeMockCtx(opts: { issueExists?: boolean; relatedExists?: boolean } = {}): RunContext {
  const { issueExists = true, relatedExists = true } = opts;
  return {
    client: {
      issue: (id: string) => {
        if (id === "ENG-42" && !issueExists) throw new Error("Entity not found");
        if (id === "ENG-38" && !relatedExists) throw new Error("Entity not found");
        return Promise.resolve({
          id: `uuid-${id}`,
          identifier: id,
        });
      },
      createIssueRelation: (input: { issueId: string; relatedIssueId: string; type: string }) =>
        Promise.resolve({
          issueRelation: Promise.resolve({
            id: "rel-1",
            type: input.type,
          }),
        }),
    } as never,
    teamId: "team-1",
    teamKey: "ENG",
  };
}

describe("relate command", () => {
  test("creates blocks relation", async () => {
    const ctx = makeMockCtx();
    const result = await relate(ctx, "ENG-42", "ENG-38", { type: "blocks" });
    expect(result.type).toBeDefined();
    expect(result.issueIdentifier).toBe("ENG-42");
    expect(result.relatedIssueIdentifier).toBe("ENG-38");
  });

  test("accepts all valid relation types", async () => {
    for (const type of ["blocks", "duplicate", "related", "similar"]) {
      const ctx = makeMockCtx();
      const result = await relate(ctx, "ENG-42", "ENG-38", { type });
      expect(result.id).toBe("rel-1");
    }
  });

  test("throws on invalid relation type", async () => {
    const ctx = makeMockCtx();
    expect(
      relate(ctx, "ENG-42", "ENG-38", { type: "depends_on" })
    ).rejects.toThrow(InputError);
  });

  test("throws when source issue not found", async () => {
    const ctx = makeMockCtx({ issueExists: false });
    expect(
      relate(ctx, "ENG-42", "ENG-38", { type: "blocks" })
    ).rejects.toThrow();
  });

  test("throws when related issue not found", async () => {
    const ctx = makeMockCtx({ relatedExists: false });
    expect(
      relate(ctx, "ENG-42", "ENG-38", { type: "blocks" })
    ).rejects.toThrow();
  });
});
