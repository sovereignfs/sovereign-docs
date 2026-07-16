import { describe, expect, it } from 'vitest';
import { parseRepository } from '../drive-rules';

describe('parseRepository', () => {
  it('parses the bare owner/repo shorthand', () => {
    expect(parseRepository('octocat/notes')).toEqual({ owner: 'octocat', repo: 'notes' });
  });

  it('parses a pasted github.com URL', () => {
    expect(parseRepository('https://github.com/octocat/notes')).toEqual({
      owner: 'octocat',
      repo: 'notes',
    });
  });

  it('strips a trailing .git suffix', () => {
    expect(parseRepository('https://github.com/octocat/notes.git')).toEqual({
      owner: 'octocat',
      repo: 'notes',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(parseRepository('  octocat/notes  ')).toEqual({ owner: 'octocat', repo: 'notes' });
  });

  it('rejects input with no slash', () => {
    expect(parseRepository('notes')).toBeNull();
  });

  it('rejects input with too many segments', () => {
    expect(parseRepository('github.com/octocat/notes/extra')).toBeNull();
  });

  it('rejects an empty owner or repo segment', () => {
    expect(parseRepository('/notes')).toBeNull();
    expect(parseRepository('octocat/')).toBeNull();
  });
});
