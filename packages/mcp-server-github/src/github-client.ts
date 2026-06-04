export interface GitHubConfig {
  /** Personal access token with issues:write. When absent, the client runs in mock mode. */
  token?: string;
  owner: string;
  repo: string;
}

export interface IssueResult {
  number: number;
  url: string;
  title: string;
  state: string;
  /** True when produced by the mock fallback (no token configured). */
  mock: boolean;
}

const API = "https://api.github.com";
const HEADERS_BASE = {
  accept: "application/vnd.github+json",
  "user-agent": "governed-support-agent",
  "x-github-api-version": "2022-11-28",
};

/**
 * The one real-API integration. With a token it files real GitHub issues; with
 * no token it returns deterministic mock issues so the demo runs end-to-end on a
 * fresh clone. The mock path is the cut-list fallback, not the default.
 */
export class GitHubClient {
  private mockCounter = 1000;

  constructor(private readonly cfg: GitHubConfig) {}

  /** True when a token is configured and calls hit the real GitHub API. */
  get live(): boolean {
    return Boolean(this.cfg.token);
  }

  get slug(): string {
    return `${this.cfg.owner}/${this.cfg.repo}`;
  }

  async createIssue(title: string, body: string, labels: string[] = []): Promise<IssueResult> {
    if (!this.cfg.token) return this.mockIssue(title, "open");
    const res = await fetch(`${API}/repos/${this.cfg.owner}/${this.cfg.repo}/issues`, {
      method: "POST",
      headers: { ...HEADERS_BASE, authorization: `Bearer ${this.cfg.token}` },
      body: JSON.stringify({ title, body, labels }),
    });
    const json = (await res.json()) as {
      number: number;
      html_url: string;
      title: string;
      state: string;
      message?: string;
    };
    if (!res.ok) throw new Error(`github createIssue failed (${res.status}): ${json.message}`);
    return {
      number: json.number,
      url: json.html_url,
      title: json.title,
      state: json.state,
      mock: false,
    };
  }

  async updateIssue(
    issueNumber: number,
    patch: { state?: "open" | "closed"; body?: string },
  ): Promise<IssueResult> {
    if (!this.cfg.token) return this.mockIssue(`issue #${issueNumber}`, patch.state ?? "open");
    const res = await fetch(
      `${API}/repos/${this.cfg.owner}/${this.cfg.repo}/issues/${issueNumber}`,
      {
        method: "PATCH",
        headers: { ...HEADERS_BASE, authorization: `Bearer ${this.cfg.token}` },
        body: JSON.stringify(patch),
      },
    );
    const json = (await res.json()) as {
      number: number;
      html_url: string;
      title: string;
      state: string;
      message?: string;
    };
    if (!res.ok) throw new Error(`github updateIssue failed (${res.status}): ${json.message}`);
    return {
      number: json.number,
      url: json.html_url,
      title: json.title,
      state: json.state,
      mock: false,
    };
  }

  private mockIssue(title: string, state: string): IssueResult {
    const number = this.mockCounter++;
    return {
      number,
      url: `https://github.com/${this.slug}/issues/${number}`,
      title,
      state,
      mock: true,
    };
  }
}

export function createGitHubClient(env: NodeJS.ProcessEnv = process.env): GitHubClient {
  return new GitHubClient({
    token: env.GITHUB_TOKEN,
    owner: env.GITHUB_OWNER ?? "demo-org",
    repo: env.GITHUB_REPO ?? "support",
  });
}
