import { describe, expect, test } from "bun:test";
import {
  projectCreate,
  projectGet,
  projectList,
  resolveProject,
} from "../../src/commands/project.js";
import { InputError } from "../../src/errors.js";
import type { RunContext } from "../../src/runner.js";

// ─── resolveProject ─────────────────────────────────────────────────────────

describe("resolveProject", () => {
  test("resolves by UUID", async () => {
    const client = {
      project: (id: string) =>
        Promise.resolve({ id: "uuid-1", name: "Test Project" }),
    } as never;
    const result = await resolveProject(client, "uuid-1");
    expect(result.id).toBe("uuid-1");
    expect(result.name).toBe("Test Project");
  });

  test("falls back to name search when UUID fails", async () => {
    const client = {
      project: () => {
        throw new Error("not found");
      },
      projects: () =>
        Promise.resolve({
          nodes: [{ id: "uuid-1", name: "My Project" }],
        }),
    } as never;
    const result = await resolveProject(client, "My Project");
    expect(result.id).toBe("uuid-1");
  });

  test("throws when no project found", async () => {
    const client = {
      project: () => {
        throw new Error("not found");
      },
      projects: () => Promise.resolve({ nodes: [] }),
    } as never;
    expect(resolveProject(client, "Ghost")).rejects.toThrow(InputError);
  });

  test("throws when multiple projects match name", async () => {
    const client = {
      project: () => {
        throw new Error("not found");
      },
      projects: () =>
        Promise.resolve({
          nodes: [
            { id: "uuid-1", name: "Dup" },
            { id: "uuid-2", name: "Dup" },
          ],
        }),
    } as never;
    expect(resolveProject(client, "Dup")).rejects.toThrow(/Multiple projects/);
  });
});

// ─── projectCreate ──────────────────────────────────────────────────────────

function makeCreateCtx(): RunContext {
  return {
    client: {
      createProject: (input: { name: string }) =>
        Promise.resolve({
          project: Promise.resolve({
            id: "proj-1",
            name: input.name,
            url: "https://linear.app/team/project/proj-1",
            status: Promise.resolve({ name: "Planned" }),
          }),
        }),
    } as never,
    teamId: "team-1",
    teamKey: "JWT",
  };
}

describe("projectCreate", () => {
  test("creates project with name only", async () => {
    const ctx = makeCreateCtx();
    const result = await projectCreate(ctx, "Q2 Auth Rewrite", {});
    expect(result.name).toBe("Q2 Auth Rewrite");
    expect(result.status).toBe("Planned");
    expect(result.url).toContain("linear.app");
  });

  test("creates project with description and target date", async () => {
    const ctx = makeCreateCtx();
    const result = await projectCreate(ctx, "Sprint 5", {
      description: "Focus on auth",
      targetDate: "2026-06-30",
    });
    expect(result.name).toBe("Sprint 5");
  });

  test("throws on empty name", async () => {
    const ctx = makeCreateCtx();
    expect(projectCreate(ctx, "", {})).rejects.toThrow(InputError);
  });

  test("throws on whitespace-only name", async () => {
    const ctx = makeCreateCtx();
    expect(projectCreate(ctx, "   ", {})).rejects.toThrow(InputError);
  });
});

// ─── projectGet ─────────────────────────────────────────────────────────────

function makeGetCtx(opts: { hasIssues?: boolean } = {}): RunContext {
  const { hasIssues = true } = opts;
  const issueNodes = hasIssues
    ? [
        {
          id: "issue-1",
          identifier: "JWT-42",
          title: "Fix auth",
          description: "Fix the auth bug",
          priority: 2,
          state: Promise.resolve({ name: "Todo" }),
          labels: () => Promise.resolve({ nodes: [{ name: "urgent" }] }),
          assignee: Promise.resolve({ name: "Will" }),
        },
      ]
    : [];

  return {
    client: {
      project: () =>
        Promise.resolve({
          id: "proj-1",
          name: "Q2 Auth",
          description: "Rewrite authentication",
          content: "# Detailed plan\n\nSome markdown content",
          progress: 0.45,
          health: "onTrack",
          url: "https://linear.app/team/project/proj-1",
          startDate: "2026-04-01",
          targetDate: "2026-06-30",
          createdAt: new Date("2026-03-24"),
          updatedAt: new Date("2026-03-24"),
          status: Promise.resolve({ name: "In Progress" }),
          teams: () => Promise.resolve({ nodes: [{ name: "JWT" }] }),
          lead: Promise.resolve({ name: "Will" }),
          issues: () => Promise.resolve({ nodes: issueNodes }),
        }),
      projects: () => Promise.resolve({ nodes: [] }),
    } as never,
    teamId: "team-1",
    teamKey: "JWT",
  };
}

describe("projectGet", () => {
  test("returns full project detail", async () => {
    const ctx = makeGetCtx();
    const result = await projectGet(ctx, "proj-1");
    expect(result.name).toBe("Q2 Auth");
    expect(result.description).toBe("Rewrite authentication");
    expect(result.status).toBe("In Progress");
    expect(result.progress).toBe(0.45);
    expect(result.health).toBe("onTrack");
    expect(result.lead).toBe("Will");
    expect(result.teams).toEqual(["JWT"]);
    expect(result.targetDate).toBe("2026-06-30");
  });

  test("includes issues", async () => {
    const ctx = makeGetCtx();
    const result = await projectGet(ctx, "proj-1");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.identifier).toBe("JWT-42");
    expect(result.issueCount).toBe(1);
  });

  test("handles project with no issues", async () => {
    const ctx = makeGetCtx({ hasIssues: false });
    const result = await projectGet(ctx, "proj-1");
    expect(result.issues).toEqual([]);
    expect(result.issueCount).toBe(0);
  });

  test("throws when project not found", async () => {
    const ctx: RunContext = {
      client: {
        project: () => {
          throw new Error("Entity not found");
        },
        projects: () => Promise.resolve({ nodes: [] }),
      } as never,
      teamId: "team-1",
      teamKey: "JWT",
    };
    expect(projectGet(ctx, "Ghost")).rejects.toThrow(InputError);
  });
});

// ─── projectList ────────────────────────────────────────────────────────────

function makeListCtx(projectNodes: unknown[] = []): RunContext {
  return {
    client: {
      projects: () => Promise.resolve({ nodes: projectNodes }),
    } as never,
    teamId: "team-1",
    teamKey: "JWT",
  };
}

describe("projectList", () => {
  test("returns project summaries", async () => {
    const ctx = makeListCtx([
      {
        id: "proj-1",
        name: "Q2 Auth",
        description: "Rewrite auth",
        progress: 0.5,
        health: "onTrack",
        url: "https://linear.app/team/project/proj-1",
        status: Promise.resolve({ name: "In Progress" }),
        issues: () => Promise.resolve({ nodes: [{ id: "i1" }, { id: "i2" }] }),
      },
    ]);
    const result = await projectList(ctx);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Q2 Auth");
    expect(result[0]!.status).toBe("In Progress");
    expect(result[0]!.issueCount).toBe(2);
  });

  test("returns empty array when no projects", async () => {
    const ctx = makeListCtx([]);
    const result = await projectList(ctx);
    expect(result).toEqual([]);
  });

  test("truncates long descriptions", async () => {
    const longDesc = "x".repeat(300);
    const ctx = makeListCtx([
      {
        id: "proj-1",
        name: "Long Desc",
        description: longDesc,
        progress: 0,
        health: "unknown",
        url: "https://linear.app",
        status: Promise.resolve({ name: "Planned" }),
        issues: () => Promise.resolve({ nodes: [] }),
      },
    ]);
    const result = await projectList(ctx);
    expect(result[0]!.descriptionPreview.endsWith("...")).toBe(true);
    expect(result[0]!.descriptionPreview.length).toBe(203);
  });
});
