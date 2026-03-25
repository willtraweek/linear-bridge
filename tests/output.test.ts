import { describe, expect, test, mock, beforeEach } from "bun:test";
import { output } from "../src/output.js";
import type { IssueSummary, IssueDetail } from "../src/types.js";

describe("output", () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    // @ts-expect-error — overriding console.log for test
    globalThis.console = {
      ...console,
      log: (...args: unknown[]) => logged.push(args.map(String).join(" ")),
    };
  });

  test("JSON mode outputs valid JSON", () => {
    const data = { id: "123", title: "test" };
    output(data, false);
    expect(logged.length).toBe(1);
    expect(JSON.parse(logged[0]!)).toEqual(data);
  });

  test("JSON mode handles arrays", () => {
    const data = [{ id: "1" }, { id: "2" }];
    output(data, false);
    expect(JSON.parse(logged[0]!)).toEqual(data);
  });

  test("human mode outputs issue summary table", () => {
    const issues: IssueSummary[] = [
      {
        id: "uuid1",
        identifier: "ENG-42",
        title: "Add auth middleware",
        state: "Todo",
        labels: ["urgent"],
        relations: [{ type: "blocked_by", issueIdentifier: "ENG-38", issueTitle: "Auth design" }],
        descriptionPreview: "Implement session-based auth...",
        commentCount: 3,
        hasSubIssues: false,
        priority: 1,
        assignee: null,
      },
    ];
    output(issues, true);
    const text = logged.join("\n");
    expect(text).toContain("ENG-42");
    expect(text).toContain("Add auth middleware");
    expect(text).toContain("urgent");
    expect(text).toContain("blocked_by");
  });

  test("human mode shows 'No issues found' for empty array", () => {
    output([], true);
    expect(logged.join("\n")).toContain("No issues found");
  });

  test("human mode shows issue detail", () => {
    const detail: IssueDetail = {
      id: "uuid1",
      identifier: "ENG-42",
      title: "Add auth middleware",
      state: "Todo",
      labels: ["urgent"],
      relations: [],
      descriptionPreview: "Implement...",
      description: "Full description here",
      commentCount: 1,
      hasSubIssues: false,
      priority: 1,
      assignee: "Will",
      comments: [
        {
          id: "c1",
          body: "[Engineers] Clear ticket",
          user: "Engineers",
          createdAt: "2026-03-24T00:00:00Z",
        },
      ],
      children: [],
      parent: null,
      url: "https://linear.app/team/ENG-42",
      createdAt: "2026-03-24T00:00:00Z",
      updatedAt: "2026-03-24T00:00:00Z",
    };
    output(detail, true);
    const text = logged.join("\n");
    expect(text).toContain("ENG-42");
    expect(text).toContain("Full description here");
    expect(text).toContain("[Engineers] Clear ticket");
  });
});
