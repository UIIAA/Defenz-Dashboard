import { describe, it, expect } from 'vitest';
import {
  daySel,
  rangeSel,
  reduceTwoClicks,
  clampSelection,
  encodeCustom,
  decodeCustom,
} from './date-range';

describe('date-range — construtores', () => {
  it('daySel', () => {
    expect(daySel('2026-07-15')).toEqual({ kind: 'dia', data: '2026-07-15' });
  });

  it('rangeSel ordena from<=to', () => {
    expect(rangeSel('2026-07-15', '2026-07-10')).toEqual({ kind: 'periodo', from: '2026-07-10', to: '2026-07-15' });
  });

  it('rangeSel com from==to colapsa para dia', () => {
    expect(rangeSel('2026-07-15', '2026-07-15')).toEqual({ kind: 'dia', data: '2026-07-15' });
  });
});

describe('date-range — reduceTwoClicks (1 clique = dia, 2 = intervalo)', () => {
  it('1º clique → dia + ancora', () => {
    expect(reduceTwoClicks(null, '2026-07-15')).toEqual({ anchor: '2026-07-15', sel: { kind: 'dia', data: '2026-07-15' } });
  });

  it('2º clique no mesmo dia → dia', () => {
    expect(reduceTwoClicks('2026-07-15', '2026-07-15')).toEqual({ anchor: null, sel: { kind: 'dia', data: '2026-07-15' } });
  });

  it('2º clique em dia posterior → intervalo', () => {
    expect(reduceTwoClicks('2026-07-10', '2026-07-15')).toEqual({ anchor: null, sel: { kind: 'periodo', from: '2026-07-10', to: '2026-07-15' } });
  });

  it('2º clique em dia anterior → intervalo ordenado (swap)', () => {
    expect(reduceTwoClicks('2026-07-15', '2026-07-10')).toEqual({ anchor: null, sel: { kind: 'periodo', from: '2026-07-10', to: '2026-07-15' } });
  });
});

describe('date-range — clampSelection', () => {
  it('dia abaixo do piso → piso', () => {
    expect(clampSelection(daySel('2026-01-01'), '2026-07-01', '2026-07-31')).toEqual(daySel('2026-07-01'));
  });

  it('intervalo é aparado nas duas pontas', () => {
    expect(clampSelection(rangeSel('2026-06-15', '2026-08-15'), '2026-07-01', '2026-07-31'))
      .toEqual({ kind: 'periodo', from: '2026-07-01', to: '2026-07-31' });
  });

  it('intervalo totalmente acima do teto colapsa para o teto (dia)', () => {
    expect(clampSelection(rangeSel('2026-08-01', '2026-08-10'), '2026-07-01', '2026-07-31'))
      .toEqual(daySel('2026-07-31'));
  });
});

describe('date-range — encode/decode custom (compat DateFilter/DateRangeProvider)', () => {
  it('dia → custom:d:d', () => {
    expect(encodeCustom(daySel('2026-07-15'))).toBe('custom:2026-07-15:2026-07-15');
  });

  it('intervalo → custom:from:to', () => {
    expect(encodeCustom(rangeSel('2026-07-10', '2026-07-15'))).toBe('custom:2026-07-10:2026-07-15');
  });

  it('decode custom:from:to → periodo', () => {
    expect(decodeCustom('custom:2026-07-10:2026-07-15')).toEqual({ kind: 'periodo', from: '2026-07-10', to: '2026-07-15' });
  });

  it('decode custom:d:d → dia (colapsa)', () => {
    expect(decodeCustom('custom:2026-07-15:2026-07-15')).toEqual(daySel('2026-07-15'));
  });

  it('encode∘decode é idempotente num intervalo', () => {
    const sel = rangeSel('2026-07-01', '2026-07-31');
    expect(decodeCustom(encodeCustom(sel))).toEqual(sel);
  });
});
