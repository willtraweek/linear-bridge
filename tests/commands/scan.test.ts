import { describe, expect, test, mock } from "bun:test";
import { scan } from "../../src/commands/scan.js";
import type { RunContext } from "../../src/runner.js";

// Mock validateState to always pass
mock.module("../../src/cache.js", () => ({
  validateState: async () => {},
  getCachedStates: async () => ["Backlog", "Triage", "Todo", "In Progress", "In Review", "Done", "Live"],
}));

function makeIssueNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "uuid-1",
    identifier: "ENG-42",
    title: "Test issue",
    description: "A test description that is short",
    priority: 1,
    labels: () => Promise.resolve({ nodes: [{ name: "urgent" }] }),
    relations: () => Promise.resolve({ nodes: [] }),
    inverseRelations: () => Promise.resolve({ nodes: [] }),
    children: () => Promise.resolve({ nodes: [] }),
    comments: () => Promise.resolve({ nodes: [{ id: "c1" }, { id: "c2" }] }),
    assignee: Promise.resolve({ name: "Will" }),
    ...overrides,
  };
}

function makeMockCtx(issueNodes: unknown[] = []): RunContext {
  return {
    client: {
      issues: () => Promise.resolve({ nodes: issueNodes }),
    } as never,
    teamId: "team-1",
    teamKey: "ENG",
  };
}

describe("scan command", () => {
  test("returns empty array when no issues match", async () => {
    const ctx = makeMockCtx([]);
    const result = await scan(ctx, { state: "Todo" });
    expect(result).toEqual([]);
  });

  test("returns issue summaries with correct fields", async () => {
    const ctx = makeMockCtx([makeIssueNode()]);
    const result = await scan(ctx, { state: "Todo" });

    expect(result).toHaveLength(1);
    expect(result[0]!.identifier).toBe("ENG-42");
    expect(result[0]!.title).toBe("Test issue");
    expect(result[0]!.state).toBe("Todo");
    expect(result[0]!.labels).toEqual(["urgent"]);
    expect(result[0]!.commentCount).toBe(2);
    expect(result[0]!.hasSubIssues).toBe(false);
    expect(result[0]!.assignee).toBe("Will");
  });

  test("truncates long descriptions to 200 chars", async () => {
    const longDesc = "x".repeat(300);
    const ctx = makeMockCtx([makeIssueNode({ description: longDesc })]);
    const result = await scan(ctx, { state: "Todo" });

    expect(result[0]!.descriptionPreview.length).toBe(203); // 200 + "..."
    expect(result[0]!.descriptionPreview.endsWith("...")).toBe(true);
  });

  test("includes outgoing relations", async () => {
    const node = makeIssueNode({
      relations: () =>
        Promise.resolve({
          nodes: [
            {
              type: "blocks",
              relatedIssue: Promise.resolve({
                identifier: "ENG-38",
                title: "Blocker",
              }),
            },
          ],
        }),
    });
    const ctx = makeMockCtx([node]);
    const result = await scan(ctx, { state: "Todo" });

    expect(result[0]!.relations).toHaveLength(1);
    expect(result[0]!.relations[0]!.type).toBe("blocks");
    expect(result[0]!.relations[0]!.issueIdentifier).toBe("ENG-38");
  });

  test("includes inverse relations with remapped types", async () => {
    const node = makeIssueNode({
      inverseRelations: () =>
        Promise.resolve({
          nodes: [
            {
              type: "blocks",
              issue: Promise.resolve({
                identifier: "ENG-55",
                title: "Upstream",
              }),
            },
          ],
        }),
    });
    const ctx = makeMockCtx([node]);
    const result = await scan(ctx, { state: "Todo" });

    const blockedByRel = result[0]!.relations.find((r) => r.type === "blocked_by");
    expect(blockedByRel).toBeDefined();
    expect(blockedByRel!.issueIdentifier).toBe("ENG-55");
  });

  test("detects sub-issues", async () => {
    const node = makeIssueNode({
      children: () =>
        Promise.resolve({ nodes: [{ id: "child-1" }] }),
    });
    const ctx = makeMockCtx([node]);
    const result = await scan(ctx, { state: "Todo" });
    expect(result[0]!.hasSubIssues).toBe(true);
  });
});
