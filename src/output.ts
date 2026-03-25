import type { IssueSummary, IssueDetail, ProjectSummary, ProjectDetail } from "./types.js";

/**
 * Print result to stdout. JSON by default, human-readable with --human.
 */
export function output(data: unknown, human?: boolean): void {
  if (human) {
    printHuman(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function printHuman(data: unknown): void {
  if (Array.isArray(data) && data.length > 0 && "health" in data[0]) {
    printProjectSummaryTable(data as ProjectSummary[]);
  } else if (Array.isArray(data)) {
    printIssueSummaryTable(data as IssueSummary[]);
  } else if (data && typeof data === "object" && "issues" in data && "health" in data) {
    printProjectDetail(data as ProjectDetail);
  } else if (data && typeof data === "object" && "description" in data) {
    printIssueDetail(data as IssueDetail);
  } else {
    // Fallback for comments, relations, etc.
    console.log(JSON.stringify(data, null, 2));
  }
}

function printIssueSummaryTable(issues: IssueSummary[]): void {
  if (issues.length === 0) {
    console.log("No issues found.");
    return;
  }

  for (const issue of issues) {
    const labels = issue.labels.length > 0 ? ` [${issue.labels.join(", ")}]` : "";
    const relations =
      issue.relations.length > 0
        ? ` (${issue.relations.map((r) => `${r.type}: ${r.issueIdentifier}`).join(", ")})`
        : "";
    console.log(`${issue.identifier}  ${issue.title}${labels}${relations}`);
    if (issue.descriptionPreview) {
      console.log(`  ${issue.descriptionPreview}`);
    }
    console.log();
  }
}

function printProjectSummaryTable(projects: ProjectSummary[]): void {
  if (projects.length === 0) {
    console.log("No projects found.");
    return;
  }

  for (const project of projects) {
    const progress = Math.round(project.progress * 100);
    console.log(`${project.name}  [${project.status}] ${progress}% — ${project.issueCount} issues`);
    if (project.descriptionPreview) {
      console.log(`  ${project.descriptionPreview}`);
    }
    console.log();
  }
}

function printProjectDetail(project: ProjectDetail): void {
  console.log(`${project.name}`);
  console.log(`Status: ${project.status}`);
  console.log(`Progress: ${Math.round(project.progress * 100)}%`);
  if (project.health !== "unknown") console.log(`Health: ${project.health}`);
  if (project.lead) console.log(`Lead: ${project.lead}`);
  if (project.teams.length) console.log(`Teams: ${project.teams.join(", ")}`);
  if (project.startDate) console.log(`Start: ${project.startDate}`);
  if (project.targetDate) console.log(`Target: ${project.targetDate}`);
  console.log(`URL: ${project.url}`);
  console.log();

  if (project.description) {
    console.log("--- Description ---");
    console.log(project.description);
    console.log();
  }

  if (project.issues.length > 0) {
    console.log(`--- Issues (${project.issueCount}) ---`);
    for (const issue of project.issues) {
      console.log(`  ${issue.identifier}: ${issue.title} [${issue.state}]`);
    }
    console.log();
  }
}

function printIssueDetail(issue: IssueDetail): void {
  console.log(`${issue.identifier}: ${issue.title}`);
  console.log(`State: ${issue.state}`);
  if (issue.labels.length) console.log(`Labels: ${issue.labels.join(", ")}`);
  if (issue.assignee) console.log(`Assignee: ${issue.assignee}`);
  if (issue.parent) console.log(`Parent: ${issue.parent.identifier} — ${issue.parent.title}`);
  console.log(`URL: ${issue.url}`);
  console.log();

  if (issue.description) {
    console.log("--- Description ---");
    console.log(issue.description);
    console.log();
  }

  if (issue.relations.length > 0) {
    console.log("--- Relations ---");
    for (const r of issue.relations) {
      console.log(`  ${r.type}: ${r.issueIdentifier} — ${r.issueTitle}`);
    }
    console.log();
  }

  if (issue.children.length > 0) {
    console.log("--- Sub-issues ---");
    for (const child of issue.children) {
      console.log(`  ${child.identifier}: ${child.title} [${child.state}]`);
    }
    console.log();
  }

  if (issue.comments.length > 0) {
    console.log("--- Comments ---");
    for (const c of issue.comments) {
      console.log(`  [${c.createdAt}] ${c.user}:`);
      console.log(`    ${c.body}`);
      console.log();
    }
  }
}
