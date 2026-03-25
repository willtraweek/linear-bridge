import { describe, expect, test } from "bun:test";
import { get } from "../../src/commands/get.js";
import type { RunContext } from "../../src/runner.js";

function makeMockCtx(issueExists = true): RunContext {
  return {
    client: {
      issue: () => {
        if (!issueExists) throw new Error("Entity not found");
        return Promise.resolve({
          id: "uuid-1",
          identifier: "ENG-42",
          title: "Test issue",
          description: "Full description of the issue",
          priority: 2,
          url: "https://linear.app/team/ENG-42",
          createdAt: new Date("2026-03-24"),
          updatedAt: new Date("2026-03-24"),
          state: Promise.resolve({ name: "Todo" }),
          labels: () => Promise.resolve({ nodes: [{ name: "urgent" }] }),
          relations: () => Promise.resolve({ nodes: [] }),
          inverseRelations: () => Promise.resolve({ nodes: [] }),
          comments: () =>
            Promise.resolve({
              nodes: [
                {
                  id: "c1",
                  body: "[Engineers] Clear ticket",
                  user: Promise.resolve({ name: "Engineers" }),
                  createdAt: new Date("2026-03-24"),
                },
              ],
            }),
          children: () => Promise.resolve({ nodes: [] }),
          parent: Promise.resolve(null),
          assignee: Promise.resolve({ name: "Will" }),
        });
      },
    } as never,
    teamId: "team-1",
    teamKey: "ENG",
  };
}

describe("get command", () => {
  test("returns full issue detail", async () => {
    const ctx = makeMockCtx();
    const result = await get(ctx, "ENG-42");

    expect(result.identifier).toBe("ENG-42");
    expect(result.title).toBe("Test issue");
    expect(result.description).toBe("Full description of the issue");
    expect(result.state).toBe("Todo");
    expect(result.labels).toEqual(["urgent"]);
    expect(result.assignee).toBe("Will");
    expect(result.url).toBe("https://linear.app/team/ENG-42");
  });

  test("includes comments", async () => {
    const ctx = makeMockCtx();
    const result = await get(ctx, "ENG-42");

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]!.body).toBe("[Engineers] Clear ticket");
    expect(result.comments[0]!.user).toBe("Engineers");
  });

  test("throws when issue not found", async () => {
    const ctx = makeMockCtx(false);
    expect(get(ctx, "ENG-999")).rejects.toThrow();
  });

  test("handles null parent", async () => {
    const ctx = makeMockCtx();
    const result = await get(ctx, "ENG-42");
    expect(result.parent).toBeNull();
  });

  test("handles null assignee", async () => {
    const ctx: RunContext = {
      client: {
        issue: () =>
          Promise.resolve({
            id: "uuid-1",
            identifier: "ENG-42",
            title: "Unassigned",
            description: "",
            priority: 3,
            url: "https://linear.app/team/ENG-42",
            createdAt: new Date("2026-03-24"),
            updatedAt: new Date("2026-03-24"),
            state: Promise.resolve({ name: "Backlog" }),
            labels: () => Promise.resolve({ nodes: [] }),
            relations: () => Promise.resolve({ nodes: [] }),
            inverseRelations: () => Promise.resolve({ nodes: [] }),
            comments: () => Promise.resolve({ nodes: [] }),
            children: () => Promise.resolve({ nodes: [] }),
            parent: Promise.resolve(null),
            assignee: Promise.resolve(null),
          }),
      } as never,
      teamId: "team-1",
      teamKey: "ENG",
    };
    const result = await get(ctx, "ENG-42");
    expect(result.assignee).toBeNull();
  });
});
