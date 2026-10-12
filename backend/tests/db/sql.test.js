import { describe, it, expect } from 'vitest';
import { buildUpdateSet } from '../../src/db/sql.js';

describe('buildUpdateSet', () => {
  const allowed = ['first_name', 'phone'];

  it('builds placeholders for allowed columns only', () => {
    const result = buildUpdateSet({ first_name: 'Ann', phone: '082', role: 'super_admin' }, allowed);

    expect(result).toEqual({
      setClause: 'first_name = $1, phone = $2',
      values: ['Ann', '082'],
      nextParam: 3,
    });
  });

  it('never puts a request key into the SQL text', () => {
    const malicious = { 'first_name = first_name; DROP TABLE users; --': 'x', first_name: 'Ann' };

    const { setClause } = buildUpdateSet(malicious, allowed);

    expect(setClause).toBe('first_name = $1');
  });

  it('skips undefined values but keeps null (to clear a column)', () => {
    const result = buildUpdateSet({ first_name: undefined, phone: null }, allowed);

    expect(result.setClause).toBe('phone = $1');
    expect(result.values).toEqual([null]);
  });

  it('can start numbering after other parameters', () => {
    const result = buildUpdateSet({ phone: '082' }, allowed, 2);

    expect(result.setClause).toBe('phone = $2');
    expect(result.nextParam).toBe(3);
  });

  it('returns an empty clause when nothing is updatable', () => {
    expect(buildUpdateSet({ role: 'x' }, allowed).setClause).toBe('');
    expect(buildUpdateSet(undefined, allowed).setClause).toBe('');
  });
});
