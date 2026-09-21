/**
 * SHAPE, second half: turn gated proposals into a pull request.
 *
 * The agent never writes to the dataset. It writes a branch containing a
 * proposals file and opens a PR describing what it wants changed, what evidence
 * it found, what the strongest argument against it was, and which gates the
 * patched dataset passed. A human merges or does not.
 *
 * That indirection is the entire safety model. Every earlier stage — the
 * falsifiability check, the refutation pass, the confidence floor, the gate —
 * exists to make this PR worth reading, not to make it unnecessary.
 */

import { config, userAgent } from '../config.ts';
import type { Logger, Proposal } from '../types.ts';

const API = 'https://api.github.com';

export interface PullRequestResult {
  url: string;
  number: number;
  branch: string;
}

interface GhError {
  message?: string;
}

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${config.github.token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': userAgent(),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers
    }
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GhError;
    throw new Error(`GitHub ${res.status} on ${path}: ${body.message ?? res.statusText}`);
  }

  return (await res.json()) as T;
}

/**
 * One branch per dataset version, reused across runs on the same day.
 *
 * Reusing it means a second run updates the existing PR rather than opening a
 * near-identical one, which is what keeps a scheduled agent from turning the
 * pull request list into a log file.
 */
function branchName(datasetVersion: string): string {
  return `harness/proposals-${datasetVersion}`;
}

export async function openProposalPullRequest(
  proposals: Proposal[],
  datasetVersion: string,
  body: string,
  log: Logger
): Promise<PullRequestResult | null> {
  if (proposals.length === 0) {
    log.info('nothing survived the gate; no pull request to open');
    return null;
  }
  if (!config.github.token) {
    log.warn('GITHUB_TOKEN is not set; writing proposals to disk only');
    return null;
  }

  const [owner, repo] = config.github.repository.split('/');
  if (!owner || !repo) throw new Error(`GITHUB_REPOSITORY is malformed: ${config.github.repository}`);

  const branch = branchName(datasetVersion);
  const base = await defaultBranch(owner, repo);
  const baseSha = await headSha(owner, repo, base);

  await ensureBranch(owner, repo, branch, baseSha, log);

  const path = `harness/proposals/${datasetVersion}.json`;
  const contents = `${JSON.stringify({ datasetVersion, generatedAt: new Date().toISOString(), proposals }, null, 2)}\n`;

  await putFile(owner, repo, branch, path, contents, `data: ${proposals.length} proposals for ${datasetVersion}`);

  const title = `Data proposals for ${datasetVersion} (${proposals.length} change${proposals.length === 1 ? '' : 's'})`;
  const existing = await findOpenPr(owner, repo, branch);

  if (existing) {
    await gh(`/repos/${owner}/${repo}/pulls/${existing.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, body })
    });
    log.info(`updated ${existing.html_url}`);
    return { url: existing.html_url, number: existing.number, branch };
  }

  const created = await gh<{ html_url: string; number: number }>(`/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, body, head: branch, base, draft: true })
  });

  log.info(`opened ${created.html_url}`);
  return { url: created.html_url, number: created.number, branch };
}

/* -------------------------------------------------------------------------- */
/* GitHub plumbing                                                             */
/* -------------------------------------------------------------------------- */

async function defaultBranch(owner: string, repo: string): Promise<string> {
  const r = await gh<{ default_branch: string }>(`/repos/${owner}/${repo}`);
  return r.default_branch;
}

async function headSha(owner: string, repo: string, branch: string): Promise<string> {
  const r = await gh<{ object: { sha: string } }>(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
  );
  return r.object.sha;
}

async function ensureBranch(
  owner: string,
  repo: string,
  branch: string,
  baseSha: string,
  log: Logger
): Promise<void> {
  try {
    await headSha(owner, repo, branch);
    log.debug(`branch ${branch} already exists; reusing it`);
  } catch {
    await gh(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha })
    });
    log.debug(`created branch ${branch}`);
  }
}

async function putFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  contents: string,
  message: string
): Promise<void> {
  // The contents API needs the blob sha to overwrite, and omitting it on an
  // existing file is a 422 rather than an overwrite.
  let sha: string | undefined;
  try {
    const existing = await gh<{ sha: string }>(
      `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`
    );
    sha = existing.sha;
  } catch {
    /* first write on this branch */
  }

  await gh(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      branch,
      content: Buffer.from(contents).toString('base64'),
      ...(sha ? { sha } : {})
    })
  });
}

async function findOpenPr(
  owner: string,
  repo: string,
  branch: string
): Promise<{ number: number; html_url: string } | null> {
  const list = await gh<Array<{ number: number; html_url: string }>>(
    `/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`
  );
  return list[0] ?? null;
}
