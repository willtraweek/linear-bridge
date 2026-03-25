import { describe, expect, test, mock } from "bun:test";
import { create } from "../../src/commands/create.js";
import { InputError } from "../../src/errors.js";
import type { RunContext } from "../../src/runner.js";

mock.module("../../src/cache.js", () => ({
  validateState: async () => {},
}));

function makeMockCtx(parentExists = true): RunContext {
  return {
    client: {
      issue: (id: string) => {
        if (!parentExists) throw new Error("Entity not found");
        return Promise.resolve({
          id: `uuid-${id}`,
          identifier: id,
        });
      },
      team: () =>
        Promise.resolve({
          states: () =>
            Promise.resolve({
              nodes: [
                { id: "state-1", name: "Todo" },
                { id: "state-2", name: "Backlog" },
              ],
            }),
          labels: () =>
            Promise.resolve({
              nodes: [{ id: "lbl-1", name: "urgent" }],
            }),
        }),
      issueLabels: () => Promise.resolve({ nodes: [] }),
      createIssue: (input: Record<string, unknown>) =>
        Promise.resolve({
          issue: Promise.resolve({
            id: "new-uuid",
            identifier: "ENG-99",
            title: input.title as string,
            url: "https://linear.app/team/ENG-99",
            state: Promise.resolve({ name: "Todo" }),
            estimate: (input.estimate as number) ?? null,
            priority: (input.priority as number) ?? 0,
          }),
        }),
    } as never,
    teamId: "team-1",
    teamKey: "ENG",
  };
}

describe("create command", () => {
  test("creates a basic issue", async () => {
    const ctx = makeMockCtx();
    const result = await create(ctx, "Fix null check", {});
    expect(result.identifier).toBe("ENG-99");
    expect(result.title).toBe("Fix null check");
    expect(result.parent).toBeNull();
  });

  test("creates sub-issue with --parent", async () => {
    const ctx = makeMockCtx();
    const result = await create(ctx, "Sub-task", { parent: "ENG-42" });
    expect(result.identifier).toBe("ENG-99");
    expect(result.parent).toBe("ENG-42");
  });

  test("creates issue with state and labels", async () => {
    const ctx = makeMockCtx();
    const result = await create(ctx, "New issue", {
      state: "Todo",
      label: ["urgent"],
    });
    expect(result.identifier).toBe("ENG-99");
  });

  test("throws on empty title", async () => {
    const ctx = makeMockCtx();
    expect(create(ctx, "", {})).rejects.toThrow(InputError);
  });

  test("throws on whitespace-only title", async () => {
    const ctx = makeMockCtx();
    expect(create(ctx, "   ", {})).rejects.toThrow(InputError);
  });

  test("throws when parent not found", async () => {
    const ctx = makeMockCtx(false);
    expect(
      create(ctx, "Sub-task", { parent: "ENG-999" })
    ).rejects.toThrow();
  });

  test("throws when label not found", async () => {
    const ctx = makeMockCtx();
    expect(
      create(ctx, "New issue", { label: ["nonexistent"] })
    ).rejects.toThrow(InputError);
  });

  test("creates issue with estimate and priority", async () => {
    const ctx = makeMockCtx();
    const result = await create(ctx, "Sized task", {
      estimate: 5,
      priority: 1,
    });
    expect(result.identifier).toBe("ENG-99");
    expect(result.estimate).toBe(5);
    expect(result.priority).toBe(1);
  });

  test("creates issue with priority 0 (None)", async () => {
    const ctx = makeMockCtx();
    const result = await create(ctx, "Low priority", { priority: 0 });
    expect(result.identifier).toBe("ENG-99");
    expect(result.priority).toBe(0);
  });

  test("throws on invalid estimate (negative)", async () => {
    const ctx = makeMockCtx();
    expect(
      create(ctx, "Bad estimate", { estimate: -1 })
    ).rejects.toThrow(InputError);
  });

  test("throws on invalid estimate (zero)", async () => {
    const ctx = makeMockCtx();
    expect(
      create(ctx, "Bad estimate", { estimate: 0 })
    ).rejects.toThrow(InputError);
  });

  test("throws on invalid priority (out of range)", async () => {
    const ctx = makeMockCtx();
    expect(
      create(ctx, "Bad priority", { priority: 5 })
    ).rejects.toThrow(InputError);
  });

  test("throws on invalid priority (non-integer)", async () => {
    const ctx = makeMockCtx();
    expect(
      create(ctx, "Bad priority", { priority: 2.5 })
    ).rejects.toThrow(InputError);
  });
});
