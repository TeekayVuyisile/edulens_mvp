import { describe, it, expect } from 'vitest';
import { validatePasswords } from '../lib/passwords';
import { errorMessage } from '../lib/http';
import { NAVIGATION } from '../config/navigation';

describe('validatePasswords', () => {
  it('accepts matching passwords of 8+ characters', () => {
    expect(validatePasswords({ password: 'abcdefgh', confirm: 'abcdefgh' })).toEqual({});
  });

  it('reports a short password and a mismatch separately', () => {
    expect(validatePasswords({ password: 'abc', confirm: 'abd' })).toEqual({
      password: 'Use at least 8 characters.',
      confirm: 'Passwords don’t match.',
    });
  });
});

describe('errorMessage', () => {
  it('prefers the server message', () => {
    expect(errorMessage({ response: { data: { message: 'Class is full' } } })).toBe('Class is full');
  });

  it('explains network failures', () => {
    expect(errorMessage({ message: 'Network Error' })).toMatch(/cannot reach the server/i);
  });

  it('falls back to the given text', () => {
    expect(errorMessage({}, 'Could not save')).toBe('Could not save');
  });
});

describe('navigation', () => {
  it('has no learner section (learners do not sign in)', () => {
    expect(Object.keys(NAVIGATION).sort()).toEqual(['school_admin', 'super_admin', 'teacher']);
  });

  it('gives every role a dashboard link and unique paths', () => {
    for (const sections of Object.values(NAVIGATION)) {
      const paths = sections.flatMap((s) => s.items.map((i) => i.to));
      expect(paths).toContain('/dashboard');
      expect(new Set(paths).size).toBe(paths.length);
    }
  });
});
