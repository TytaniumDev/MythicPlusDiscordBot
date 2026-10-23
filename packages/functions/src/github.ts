export const GITHUB_REPO = { owner: 'TytaniumDev', name: 'MythicPlusDiscordBot' } as const;

export interface NewGithubIssue {
  title: string;
  body: string;
  labels: string[];
}

export interface GithubIssue {
  number: number;
  html_url: string;
  title: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Open an issue on the Wheelson repo. Throws if GitHub refuses. */
export async function createGithubIssue(token: string, issue: NewGithubIssue): Promise<GithubIssue> {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issue),
    },
  );
  if (response.status !== 201) {
    throw new Error(`Failed to create GitHub issue: HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  if (
    !isRecord(data)
    || typeof data.number !== 'number'
    || typeof data.html_url !== 'string'
    || typeof data.title !== 'string'
  ) {
    throw new Error('GitHub returned an unexpected issue shape');
  }
  return { number: data.number, html_url: data.html_url, title: data.title };
}
