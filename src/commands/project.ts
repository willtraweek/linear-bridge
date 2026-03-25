import type { LinearClient } from "@linear/sdk";
import type { RunContext } from "../runner.js";
import type { ProjectSummary, ProjectDetail, IssueSummary } from "../types.js";
import { InputError } from "../errors.js";

// ─── Shared project resolver ────────────────────────────────────────────────

/**
 * Resolve a project by UUID or name. If the input looks like a UUID, try direct
 * lookup first. Otherwise search by name. Throws InputError if not found or
 * ambiguous.
 */
export async function resolveProject(
  client: LinearClient,
  nameOrId: string
): Promise<{ id: string; name: string }> {
  // Try direct lookup (works for UUIDs)
  try {
    const project = await client.project(nameOrId);
    if (project) return { id: project.id, name: project.name };
  } catch {
    // Not a valid ID — fall through to name search
  }

  // Search by name
  const results = await client.projects({
    filter: { name: { eq: nameOrId } },
  });

  if (results.nodes.length === 0) {
    throw new InputError(`Project '${nameOrId}' not found.`);
  }

  if (results.nodes.length > 1) {
    const names = results.nodes.map((p) => `${p.name} (${p.id})`).join("\n  ");
    throw new InputError(
      `Multiple projects match '${nameOrId}'. Use the UUID instead:\n  ${names}`
    );
  }

  const project = results.nodes[0]!;
  return { id: project.id, name: project.name };
}

// ─── project create ─────────────────────────────────────────────────────────

interface CreateOpts {
  description?: string;
  targetDate?: string;
}

interface CreateResult {
  id: string;
  name: string;
  status: string;
  url: string;
}

export async function projectCreate(
  ctx: RunContext,
  name: string,
  opts: CreateOpts
): Promise<CreateResult> {
  if (!name || name.trim().length === 0) {
    throw new InputError("Project name is required.");
  }

  const payload = await ctx.client.createProject({
    name: name.trim(),
    teamIds: [ctx.teamId],
    description: opts.description,
    targetDate: opts.targetDate,
  });

  const created = await payload.project;
  if (!created) {
    throw new InputError("Failed to create project.");
  }

  const status = await created.status;

  return {
    id: created.id,
    name: created.name,
    status: status?.name || "Unknown",
    url: created.url,
  };
}

// ─── project get ────────────────────────────────────────────────────────────

export async function projectGet(
  ctx: RunContext,
  nameOrId: string
): Promise<ProjectDetail> {
  const resolved = await resolveProject(ctx.client, nameOrId);
  const project = await ctx.client.project(resolved.id);

  const status = await project.status;
  const teamsConn = await project.teams();
  const teams = teamsConn.nodes.map((t) => t.name);
  const lead = await project.lead;

  // Issues — capped at default page size (50)
  const issuesConn = await project.issues();
  const issues: IssueSummary[] = [];
  for (const issue of issuesConn.nodes) {
    const issueState = await issue.state;
    const labels = (await issue.labels()).nodes.map((l) => l.name);
    issues.push({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      state: issueState?.name || "Unknown",
      labels,
      relations: [],
      descriptionPreview: (issue.description || "").slice(0, 200),
      commentCount: 0,
      hasSubIssues: false,
      priority: issue.priority,
      assignee: (await issue.assignee)?.name || null,
    });
  }

  const description = project.description || "";

  return {
    id: project.id,
    name: project.name,
    description,
    content: project.content || null,
    status: status?.name || "Unknown",
    progress: project.progress,
    health: project.health || "unknown",
    issueCount: issues.length,
    descriptionPreview:
      description.length > 200 ? description.slice(0, 200) + "..." : description,
    url: project.url,
    startDate: project.startDate || null,
    targetDate: project.targetDate || null,
    teams,
    lead: lead?.name || null,
    issues,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

// ─── project list ───────────────────────────────────────────────────────────

export async function projectList(
  ctx: RunContext
): Promise<ProjectSummary[]> {
  const projects = await ctx.client.projects({
    filter: {
      accessibleTeams: { id: { eq: ctx.teamId } },
    },
  });

  const summaries: ProjectSummary[] = [];

  for (const project of projects.nodes) {
    const status = await project.status;
    const issuesConn = await project.issues();
    const description = project.description || "";

    summaries.push({
      id: project.id,
      name: project.name,
      status: status?.name || "Unknown",
      progress: project.progress,
      health: project.health || "unknown",
      issueCount: issuesConn.nodes.length,
      descriptionPreview:
        description.length > 200
          ? description.slice(0, 200) + "..."
          : description,
      url: project.url,
    });
  }

  return summaries;
}
