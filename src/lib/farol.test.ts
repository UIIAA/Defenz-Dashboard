import { describe, it, expect } from 'vitest';
import { computeFarol, grade } from './farol';
import type { RawDeal } from './types';

// America/Sao_Paulo is UTC-3 year-round (Brazil dropped DST in 2019), so we pick
// UTC instants that map to known BRT wall-clock times.
//   Mon 2026-07-13 07:00 BRT = 2026-07-13T10:00:00Z
//   Mon 2026-07-13 08:00 BRT = 2026-07-13T11:00:00Z
//   Wed 2026-07-15 12:00 BRT = 2026-07-15T15:00:00Z
//   Sat 2026-07-18 10:00 BRT = 2026-07-18T13:00:00Z
//   Wed 2026-07-29 12:00 BRT = 2026-07-29T15:00:00Z
//   Wed 2026-08-12 12:00 BRT = 2026-08-12T15:00:00Z
// July 2026 Mondays: 6, 13, 20, 27 → 4 weeks.  August 2026 Mondays: 3,10,17,24,31 → 5 weeks.

const won = (valor: number | string, closing_date: string, stage = 'Fechado Ganho'): RawDeal => ({
  stage,
  valor,
  closing_date,
});

describe('computeFarol — semana (pace + cor)', () => {
  it('antes de segunda 8h: elapsed 0 → expected 0, verde', () => {
    const now = new Date('2026-07-13T10:00:00Z'); // Mon 07:00 BRT
    const f = computeFarol([], now);
    expect(f.semana.expected).toBe(0);
    expect(f.semana.revenue).toBe(0);
    expect(f.semana.cor).toBe('verde');
    expect(f.semana.label).toBe('no ritmo');
  });

  it('meio de semana, zerado → vermelho / fora do ritmo', () => {
    const now = new Date('2026-07-15T15:00:00Z'); // Wed 12:00 BRT
    const f = computeFarol([], now);
    expect(f.semana.revenue).toBe(0);
    expect(f.semana.expected).toBeGreaterThan(0);
    expect(f.semana.cor).toBe('vermelho');
    expect(f.semana.label).toBe('fora do ritmo');
  });

  it('meta batida → verde / batido, pctAbs 1', () => {
    const now = new Date('2026-07-15T15:00:00Z'); // Wed
    const f = computeFarol([won(6000, '2026-07-14')], now);
    expect(f.semana.revenue).toBe(6000);
    expect(f.semana.pctAbs).toBe(1);
    expect(f.semana.cor).toBe('verde');
    expect(f.semana.label).toBe('batido');
  });

  // Regra de cor pós-T3 (vermelho reservado a pctAbs<0.5): 2500/6000 ≈ 0.417 < 0.5
  // → vermelho, mesmo estando abaixo do pace esperado (≈2786). Era amarelo pelo
  // threshold antigo (revenue >= 0.8×esperado).
  it('meio de semana, abaixo de 50% da meta → vermelho / fora do ritmo', () => {
    const now = new Date('2026-07-15T15:00:00Z'); // Wed 12:00, esperado ≈ 2786
    const f = computeFarol([won(2500, '2026-07-15')], now);
    expect(f.semana.cor).toBe('vermelho');
    expect(f.semana.label).toBe('fora do ritmo');
  });

  it('sábado é overtime: elapsed 1 → expected == meta semanal', () => {
    const now = new Date('2026-07-18T13:00:00Z'); // Sat 10:00 BRT
    const f = computeFarol([won(3000, '2026-07-15')], now);
    expect(f.semana.expected).toBe(6000);
    expect(f.semana.cor).toBe('amarelo'); // 3000/6000 = 0.5 → pctAbs>=0.5 (regra pós-T3)
  });

  it('atribuição por closing_date: deal fora da semana não conta', () => {
    const now = new Date('2026-07-15T15:00:00Z'); // semana 13–19/07
    const f = computeFarol([won(9000, '2026-07-06')], now); // semana anterior
    expect(f.semana.revenue).toBe(0);
  });

  it('valor como string é somado (RawDeal.valor pode ser string)', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const f = computeFarol([won('6000', '2026-07-14')], now);
    expect(f.semana.revenue).toBe(6000);
  });

  it('deals em pipeline não contam como ganho', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const f = computeFarol([won(6000, '2026-07-14', 'Proposta Enviada')], now);
    expect(f.semana.revenue).toBe(0);
  });

  it('“Contrato Enviado” conta como ganho (reconcilia com o dashboard)', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const f = computeFarol([won(6000, '2026-07-14', 'Contrato Enviado')], now);
    expect(f.semana.revenue).toBe(6000);
  });
});

describe('computeFarol — mês (semanas-no-mês + atribuição)', () => {
  it('julho/2026 → 4 semanas → meta mensal 24000', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const f = computeFarol([], now);
    expect(f.mes.goal).toBe(24000);
  });

  it('agosto/2026 → 5 semanas → meta mensal 30000', () => {
    const now = new Date('2026-08-12T15:00:00Z'); // Wed 12:00 BRT
    const f = computeFarol([], now);
    expect(f.mes.goal).toBe(30000);
  });

  it('deal de sáb 01/08 conta em julho (semana começa 27/07)', () => {
    const now = new Date('2026-07-29T15:00:00Z'); // Wed, mês = julho
    const f = computeFarol([won(5000, '2026-08-01')], now);
    expect(f.mes.revenue).toBe(5000);
  });

  it('pace mensal: seg 8h de julho → 1 semana cheia passada de 4 → expected 6000', () => {
    const now = new Date('2026-07-13T11:00:00Z'); // Mon 08:00 BRT, semana atual 13/07
    const f = computeFarol([], now);
    expect(f.mes.expected).toBe(6000); // 24000 * (1 semana cheia / 4)
  });
});

describe('grade — vermelho reservado', () => {
  it('semana fechada com 60% da meta e abaixo do pace → amarelo, não vermelho', () => {
    expect(grade(3600, 6000, 6000).cor).toBe('amarelo'); // pctAbs 0.6, revenue<expected
  });
  it('semana fechada com 30% da meta → vermelho', () => {
    expect(grade(1800, 6000, 6000).cor).toBe('vermelho'); // pctAbs 0.3
  });
  it('no ritmo (revenue>=expected) segue verde', () => {
    expect(grade(1000, 6000, 800).cor).toBe('verde');
  });
});

describe('computeFarol — metadados', () => {
  it('generatedAt é o ISO do now', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const f = computeFarol([], now);
    expect(f.generatedAt).toBe(now.toISOString());
  });
});

// --- feature-cnpj-identidade-empresa: ganho sem closing_date ---

describe('computeFarol — ganho sem closing_date', () => {
  // 13 dos 78 ganhos (R$ 78.186,59) não têm closing_date no Zoho. Antes o Farol descartava
  // essa receita de todas as semanas e meses, enquanto metrics.ts a contava. Agora cai no
  // modified_time, igual ao resto do dashboard.
  const semFechamento = (valor: number, modified_time: string): RawDeal => ({
    stage: 'Fechado Ganho',
    valor,
    closing_date: '',
    modified_time,
  });

  it('entra na semana pela data de modificação', () => {
    const now = new Date('2026-07-15T15:00:00Z'); // Qua 12:00 BRT, semana de 13/07
    const f = computeFarol([semFechamento(1736, '2026-07-15')], now);
    expect(f.semana.revenue).toBe(1736);
  });

  it('entra no mês pela data de modificação', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const f = computeFarol([semFechamento(1736, '2026-07-15')], now);
    expect(f.mes.revenue).toBe(1736);
  });

  it('closing_date continua tendo precedência sobre modified_time', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const d: RawDeal = {
      stage: 'Fechado Ganho',
      valor: 500,
      closing_date: '2026-07-15',
      modified_time: '2026-08-20', // fora da semana; não pode vencer
    };
    expect(computeFarol([d], now).semana.revenue).toBe(500);
  });

  it('sem nenhuma das duas datas continua fora', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const f = computeFarol([{ stage: 'Fechado Ganho', valor: 999 }], now);
    expect(f.semana.revenue).toBe(0);
    expect(f.mes.revenue).toBe(0);
  });
});
