import { describe, it, expect } from 'vitest';
import { getDateRange } from './periodo';

// Conta datas distintas no intervalo fechado [start, end].
function datasNoIntervalo(start: string, end: string): number {
  let n = 0;
  for (let d = start; d <= end; ) {
    n++;
    const [y, m, dd] = d.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, dd));
    dt.setUTCDate(dt.getUTCDate() + 1);
    d = dt.toISOString().slice(0, 10);
  }
  return n;
}

const HOJE = '2026-09-02';

describe('getDateRange — presets cobrem o número de datas que o nome promete', () => {
  it('"7d" cobre exatamente 7 datas, não 8', () => {
    const r = getDateRange('7d', HOJE);
    expect(datasNoIntervalo(r.start, r.end)).toBe(7);
    expect(r.start).toBe('2026-08-27');
    expect(r.end).toBe(HOJE);
  });

  it('"15d" cobre exatamente 15 datas', () => {
    const r = getDateRange('15d', HOJE);
    expect(datasNoIntervalo(r.start, r.end)).toBe(15);
  });

  it('"30d" cobre exatamente 30 datas', () => {
    const r = getDateRange('30d', HOJE);
    expect(datasNoIntervalo(r.start, r.end)).toBe(30);
  });

  it('"today" é um dia só', () => {
    const r = getDateRange('today', HOJE);
    expect(r.start).toBe(HOJE);
    expect(r.end).toBe(HOJE);
  });
});

describe('getDateRange — o rótulo mostra as datas', () => {
  it('"7d" diz de quando até quando, não só "Últimos 7 dias"', () => {
    expect(getDateRange('7d', HOJE).label).toBe('27/08 a 02/09');
  });

  it('"month" mostra o intervalo do mês corrente', () => {
    const r = getDateRange('month', HOJE);
    expect(r.start).toBe('2026-09-01');
    expect(r.label).toBe('01/09 a 02/09');
  });
});

describe('getDateRange — não usa o relógio da máquina', () => {
  it('deriva tudo da data passada, então 31/12 não vaza para o ano seguinte', () => {
    const r = getDateRange('7d', '2026-12-31');
    expect(r.end).toBe('2026-12-31');
    expect(r.start).toBe('2026-12-25');
  });
});

describe('getDateRange — custom continua funcionando', () => {
  it('aceita custom:from:to', () => {
    const r = getDateRange('custom:2026-08-01:2026-08-31', HOJE);
    expect(r.start).toBe('2026-08-01');
    expect(r.end).toBe('2026-08-31');
    expect(r.label).toBe('01/08 a 31/08');
  });

  it('custom malformado cai para hoje', () => {
    const r = getDateRange('custom:lixo', HOJE);
    expect(r.start).toBe(HOJE);
    expect(r.end).toBe(HOJE);
  });
});
