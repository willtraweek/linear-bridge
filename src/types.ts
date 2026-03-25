export interface GlobalOpts {
  team?: string;
  human?: boolean;
}

export interface IssueSummary {
  id: string;
  identifier: string;
  title: string;
  state: string;
  labels: string[];
  relations: RelationSummary[];
  descriptionPreview: string;
  commentCount: number;
  hasSubIssues: boolean;
  priority: number;
  estimate: number | null;
  assignee: string | null;
}

export interface RelationSummary {
  type: string;
  issueIdentifier: string;
  issueTitle: string;
}

export interface IssueDetail extends IssueSummary {
  description: string;
  comments: CommentDetail[];
  children: IssueSummary[];
  parent: { id: string; identifier: string; title: string } | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDetail {
  id: string;
  body: string;
  user: string;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  progress: number;
  health: string;
  issueCount: number;
  descriptionPreview: string;
  url: string;
}

export interface ProjectDetail extends ProjectSummary {
  description: string;
  content: string | null;
  startDate: string | null;
  targetDate: string | null;
  teams: string[];
  lead: string | null;
  issues: IssueSummary[];
  createdAt: string;
  updatedAt: string;
}

export const EXIT_SUCCESS = 0;
export const EXIT_INPUT_ERROR = 1;
export const EXIT_UNREACHABLE = 2;
export const EXIT_AUTH_FAILURE = 3;
export const EXIT_RATE_LIMITED = 4;
