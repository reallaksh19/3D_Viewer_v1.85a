import { describe, expect, it } from 'vitest';
import {
  splitScopeTokens,
  rvmScopeRegex,
  matchesScopeText,
} from '../converters/rvm-scope-pattern.js';

describe('rvm-scope-pattern', () => {
  it('splits a separated list of tokens (comma/semicolon/newline)', () => {
    expect(splitScopeTokens('S8810101, S8810111; S88112\nS8810103')).toEqual([
      'S8810101',
      'S8810111',
      'S88112',
      'S8810103',
    ]);
  });

  it('returns null for an empty pattern (matches everything)', () => {
    expect(rvmScopeRegex('')).toBeNull();
    expect(matchesScopeText('anything', '')).toBe(true);
  });

  it('matches any token in a multi-pattern selection (incl. S8810103)', () => {
    const pattern = 'S8810101, S8810111, S88112, S8810103, S8811951';
    expect(matchesScopeText('/ASIM-1885-8"-S8810103-91261M7-HC/B1', pattern)).toBe(true);
    expect(matchesScopeText('/ASIM-1885-10"-S8810101-91261M7-HC/B7', pattern)).toBe(true);
    // A pipe outside the selection is excluded.
    expect(matchesScopeText('/ASIM-1885-6"-S8819999-91261M7-HC/B1', pattern)).toBe(false);
  });

  it('preserves legacy single substring matching', () => {
    expect(matchesScopeText('/ASIM-1885-8"-S8810103-91261M7-HC/B1', 'S8810103')).toBe(true);
    expect(matchesScopeText('/ASIM-1885-8"-S8810103-91261M7-HC/B1', 'S8819999')).toBe(false);
  });

  it('honours glob wildcards within a token (anchored full-string)', () => {
    expect(matchesScopeText('/ASIM-1885-8"-S8810103-91261M7-HC/B1', '*S8810103*')).toBe(true);
    expect(matchesScopeText('S8810103', '*S8810103*')).toBe(true);
    // Anchored glob does not substring-match when anchors fail.
    expect(matchesScopeText('prefix S8810103 suffix', 'S8810103*')).toBe(false);
  });
});
