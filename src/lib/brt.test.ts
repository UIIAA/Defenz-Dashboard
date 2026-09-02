import { describe, it, expect } from 'vitest';
import { hojeBRT } from './brt';

describe('hojeBRT', () => {
  it('não vira o dia às 21h de Brasília (o bug do toISOString)', () => {
    // 21h30 BRT de 02/09 = 00h30 UTC de 03/09. O dashboard mostrava 03.
    expect(hojeBRT(new Date('2026-09-02T21:30:00-03:00'))).toBe('2026-09-02');
  });

  it('vira o dia à meia-noite de Brasília, não antes', () => {
    expect(hojeBRT(new Date('2026-09-02T23:59:59-03:00'))).toBe('2026-09-02');
    expect(hojeBRT(new Date('2026-09-03T00:00:01-03:00'))).toBe('2026-09-03');
  });
});
