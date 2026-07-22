import { describe, it, expect } from 'vitest';
import { metaPeriodo, diasNoPeriodo } from './metas-canal';

describe('escala de meta', () => {
  it('diasNoPeriodo inclui as duas pontas', () => {
    expect(diasNoPeriodo('2026-07-01', '2026-07-31')).toBe(31);
    expect(diasNoPeriodo('2026-07-10', '2026-07-10')).toBe(1);
  });
  it('metaPeriodo = mensal × dias / 30 arredondado', () => {
    expect(metaPeriodo(30000, 30)).toBe(30000);
    expect(metaPeriodo(30000, 15)).toBe(15000);
    expect(metaPeriodo(40000, 56)).toBe(Math.round(40000 * 56 / 30));
  });
  it('mensal 0 → 0', () => { expect(metaPeriodo(0, 56)).toBe(0); });
});
