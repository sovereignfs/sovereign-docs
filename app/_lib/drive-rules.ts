export const DEFAULT_BASE_PATH = 'docs';

/**
 * Parses a user-typed repository reference into owner/repo. Accepts the bare
 * `owner/repo` shorthand as well as a pasted `https://github.com/owner/repo`
 * or `.../owner/repo.git` URL, since users commonly copy the address bar
 * rather than typing the shorthand.
 */
export function parseRepository(input: string): { owner: string; repo: string } | null {
  const trimmed = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!owner || !repo) return null;
  return { owner, repo };
}

/** Sanitizes a thrown error into copy safe to show the user — never the raw message, which may echo the token. */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong talking to GitHub. Try again.';
}
