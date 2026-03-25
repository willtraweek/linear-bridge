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

export const EXIT_SUCCESS = 0;
export const EXIT_INPUT_ERROR = 1;
export const EXIT_UNREACHABLE = 2;
export const EXIT_AUTH_FAILURE = 3;
export const EXIT_RATE_LIMITED = 4;
