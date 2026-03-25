import { describe, expect, test, mock } from "bun:test";
import { update } from "../../src/commands/update.js";
import { InputError } from "../../src/errors.js";
import type { RunContext } from "../../src/runner.js";

// Mock validateState to always pass
mock.module("../../src/cache.js", () => ({
  validateState: async () => {},
}));

function makeMockCtx(issueExists = true): RunContext {
  const currentLabels = [
    { id: "lbl-1", name: "urgent" },
    { id: "lbl-2", name: "needs product decision" },
  ];

  return {
    client: {
      issue: () => {
        if (!issueExists) throw new Error("Entity not found");
        return Promise.resolve({
          id: "uuid-1",
          identifier: "ENG-42",
          title: "Test issue",
          labels: () => Promise.resolve({ nodes: currentLabels }),
          state: Promise.resolve({ name: "Todo" }),
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
      updateIssue: () => Promise.resolve({ success: true }),
    } as never,
    teamId: "team-1",
    teamKey: "ENG",
  };
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
});
