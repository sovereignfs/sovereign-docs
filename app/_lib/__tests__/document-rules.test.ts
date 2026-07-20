import { describe, expect, it } from 'vitest';
import { buildGitPath, resolveDocumentStorage, slugify, uniqueSlug } from '../document-rules';

describe('slugify', () => {
  it('lowercases and dashes a normal title', () => {
    expect(slugify('Q3 Roadmap')).toBe('q3-roadmap');
  });

  it('trims leading/trailing punctuation', () => {
    expect(slugify('  -- Hello, World! --  ')).toBe('hello-world');
  });

  it('falls back to "untitled" when nothing survives', () => {
    expect(slugify('!!!')).toBe('untitled');
    expect(slugify('   ')).toBe('untitled');
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when there is no collision', () => {
    expect(uniqueSlug('notes', new Set())).toBe('notes');
  });

  it('appends -2 on a single collision', () => {
    expect(uniqueSlug('notes', new Set(['notes']))).toBe('notes-2');
  });

  it('finds the first free numeric suffix', () => {
    expect(uniqueSlug('notes', new Set(['notes', 'notes-2', 'notes-3']))).toBe('notes-4');
  });
});

describe('buildGitPath', () => {
  it('joins basePath and slug for a standalone document', () => {
    expect(buildGitPath('docs', null, 'onboarding')).toBe('docs/onboarding.md');
  });

  it('includes the project slug when present', () => {
    expect(buildGitPath('docs', 'handbook', 'onboarding')).toBe('docs/handbook/onboarding.md');
  });
});

describe('resolveDocumentStorage', () => {
  it('allows a local document under the limit', () => {
    expect(resolveDocumentStorage('local', 5, 25, false)).toEqual({ ok: true, storage: 'local' });
  });

  it('blocks a local document at the limit with no drive connected', () => {
    const result = resolveDocumentStorage('local', 25, 25, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/reached your 25 free documents/);
      expect(result.error).not.toMatch(/git-backed/);
    }
  });

  it('offers a git-backed retry when at the limit with a drive connected', () => {
    const result = resolveDocumentStorage('local', 25, 25, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/git-backed instead/);
    }
  });

  it('blocks a git-backed request with no drive connected', () => {
    const result = resolveDocumentStorage('git', 0, 25, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Connect a Git repository/);
    }
  });

  it('allows a git-backed document with a drive connected, ignoring the local count', () => {
    expect(resolveDocumentStorage('git', 999, 25, true)).toEqual({ ok: true, storage: 'git' });
  });
});
