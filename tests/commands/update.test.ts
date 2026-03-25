import { describe, expect, test, mock } from "bun:test";
import { update } from "../../src/commands/update.js";
import { InputError } from "../../src/errors.js";
import type { RunContext } from "../../src/runner.js";

// Mock validateState and resolveProject
mock.module("../../src/cache.js", () => ({
  validateState: async () => {},
}));

mock.module("../../src/commands/project.js", () => ({
  resolveProject: async (_client: unknown, nameOrId: string) => {
    if (nameOrId === "Ghost Project") throw new (require("../../src/errors.js").InputError)("Project 'Ghost Project' not found.");
    return { id: "proj-1", name: nameOrId };
  },
}));

function makeMockCtx(issueExists = true): RunContext & { updateIssueCalls: Array<[string, Record<string, unknown>]> } {
  const currentLabels = [
    { id: "lbl-1", name: "urgent" },
    { id: "lbl-2", name: "needs product decision" },
  ];

  const updateIssueCalls: Array<[string, Record<string, unknown>]> = [];

  const ctx = {
    client: {
      issue: () => {
        if (!issueExists) throw new Error("Entity not found");
        return Promise.resolve({
          id: "uuid-1",
          identifier: "ENG-42",
          title: "Test issue",
          labels: () => Promise.resolve({ nodes: currentLabels }),
          state: Promise.resolve({ name: "Todo" }),
          estimate: 3,
          priority: 2,
        });
      },
      team: () =>
        Promise.resolve({
          states: () =>
            Promise.resolve({
              nodes: [
                { id: "state-1", name: "Todo" },
                { id: "state-2", name: "In Progress" },
                { id: "state-3", name: "Backlog" },
              ],
            }),
          labels: () =>
            Promise.resolve({
              nodes: [
                { id: "lbl-1", name: "urgent" },
                { id: "lbl-2", name: "needs product decision" },
                { id: "lbl-3", name: "requires engineering review" },
              ],
            }),
        }),
      issueLabels: () =>
        Promise.resolve({ nodes: [] }),
      updateIssue: (id: string, input: Record<string, unknown>) => {
        updateIssueCalls.push([id, input]);
        return Promise.resolve({ success: true });
      },
    } as never,
    teamId: "team-1",
    teamKey: "ENG",
    updateIssueCalls,
  };

  return ctx as RunContext & { updateIssueCalls: Array<[string, Record<string, unknown>]> };
}

describe("update command", () => {
  test("throws when no update flags provided", async () => {
    const ctx = makeMockCtx();
    expect(update(ctx, "ENG-42", {})).rejects.toThrow(InputError);
    expect(update(ctx, "ENG-42", {})).rejects.toThrow(/At least one update flag/);
  });

  test("updates state successfully", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", { state: "In Progress" });
    expect(result.identifier).toBe("ENG-42");
  });

  test("adds labels successfully", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", {
      addLabel: ["requires engineering review"],
    });
    expect(result.identifier).toBe("ENG-42");
  });

  test("removes labels successfully", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", {
      removeLabel: ["urgent"],
    });
    expect(result.identifier).toBe("ENG-42");
  });

  test("combines state and label operations", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", {
      state: "Backlog",
      addLabel: ["needs product decision"],
    });
    expect(result.identifier).toBe("ENG-42");
  });

  test("throws when issue not found", async () => {
    const ctx = makeMockCtx(false);
    expect(
      update(ctx, "ENG-999", { state: "In Progress" })
    ).rejects.toThrow();
  });

  test("throws when label not found", async () => {
    const ctx = makeMockCtx();
    expect(
      update(ctx, "ENG-42", { addLabel: ["nonexistent-label"] })
    ).rejects.toThrow(InputError);
  });

  test("sets project on issue", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", { project: "Q2 Auth" });
    expect(result.identifier).toBe("ENG-42");
  });

  test("removes project from issue", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", { removeProject: true });
    expect(result.identifier).toBe("ENG-42");
  });

  test("throws when project not found", async () => {
    const ctx = makeMockCtx();
    expect(
      update(ctx, "ENG-42", { project: "Ghost Project" })
    ).rejects.toThrow(InputError);
  });

  test("sets estimate on issue", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", { estimate: 5 });
    expect(result.identifier).toBe("ENG-42");
    expect(ctx.updateIssueCalls).toContainEqual(["uuid-1", { estimate: 5 }]);
  });

  test("sets priority on issue", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", { priority: 1 });
    expect(result.identifier).toBe("ENG-42");
    expect(ctx.updateIssueCalls).toContainEqual(["uuid-1", { priority: 1 }]);
  });

  test("sets priority 0 (None)", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", { priority: 0 });
    expect(result.identifier).toBe("ENG-42");
    expect(ctx.updateIssueCalls).toContainEqual(["uuid-1", { priority: 0 }]);
  });

  test("combines estimate and priority with other flags", async () => {
    const ctx = makeMockCtx();
    const result = await update(ctx, "ENG-42", {
      state: "In Progress",
      estimate: 3,
      priority: 2,
    });
    expect(result.identifier).toBe("ENG-42");
    expect(ctx.updateIssueCalls).toContainEqual(["uuid-1", { estimate: 3 }]);
    expect(ctx.updateIssueCalls).toContainEqual(["uuid-1", { priority: 2 }]);
  });

  test("throws on invalid estimate (negative)", async () => {
    const ctx = makeMockCtx();
    expect(
      update(ctx, "ENG-42", { estimate: -1 })
    ).rejects.toThrow(InputError);
  });

  test("throws on invalid estimate (zero)", async () => {
    const ctx = makeMockCtx();
    expect(
      update(ctx, "ENG-42", { estimate: 0 })
    ).rejects.toThrow(InputError);
  });

  test("throws on invalid priority (out of range)", async () => {
    const ctx = makeMockCtx();
    expect(
      update(ctx, "ENG-42", { priority: 5 })
    ).rejects.toThrow(InputError);
  });

  test("throws on invalid priority (negative)", async () => {
    const ctx = makeMockCtx();
    expect(
      update(ctx, "ENG-42", { priority: -1 })
    ).rejects.toThrow(InputError);
  });
});
