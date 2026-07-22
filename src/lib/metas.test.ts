import { describe, it, expect } from 'vitest';
import { computeMetas, weekRevenue, weeklyEsforco, fonteVenda, computeEficiencia } from './metas';
import type { RawDeal, RawResumoDiario } from './types';

// America/Sao_Paulo é UTC-3 o ano todo (sem DST desde 2019). Mesmos instantes-âncora
// usados em farol.test.ts, pra reconciliar (bater os mesmos números).
//   Mon 2026-07-13 08:00 BRT = 2026-07-13T11:00:00Z
//   Wed 2026-07-15 12:00 BRT = 2026-07-15T15:00:00Z
//   Wed 2026-07-29 12:00 BRT = 2026-07-29T15:00:00Z
// Julho/2026: segundas 06, 13, 20, 27.

const won = (valor: number | string, closing_date: string, stage = 'Fechado Ganho'): RawDeal => ({
  stage,
  valor,
  closing_date,
});

const resumo = (data: string, fields: Partial<RawResumoDiario> = {}): RawResumoDiario => ({
  data,
  atualizado_em: `${data}T18:00:00.000Z`,
  ligacoes_total: 0,
  emails_total: 0,
  apresentacoes_total: 0,
  propostas_total: 0,
  reuniao_tecnica_total: 0,
  ...fields,
});

describe('weekRevenue — atribuição por closing_date (mesma regra do Farol)', () => {
  // won() não seta lead_source → classifyOrigin('') cai no default 'direto' →
  // fonteVenda === 'defenz'. Por isso toda a receita destes testes cai no balde
  // `defenz` (repasse = 0); a partição em si é coberta no describe dedicado abaixo.
  it('soma deals ganhos com closing_date dentro da janela', () => {
    const deals = [won(6000, '2026-07-14')];
    expect(weekRevenue(deals, '2026-07-13', '2026-07-19')).toEqual({ defenz: 6000, repasse: 0, defenzCount: 1, repasseCount: 0 });
  });

  it('deal fora da janela não conta', () => {
    const deals = [won(9000, '2026-07-06')];
    expect(weekRevenue(deals, '2026-07-13', '2026-07-19')).toEqual({ defenz: 0, repasse: 0, defenzCount: 0, repasseCount: 0 });
  });

  it('valor como string é somado', () => {
    const deals = [won('6000', '2026-07-14')];
    expect(weekRevenue(deals, '2026-07-13', '2026-07-19')).toEqual({ defenz: 6000, repasse: 0, defenzCount: 1, repasseCount: 0 });
  });

  it('deal em pipeline (não ganho) não conta', () => {
    const deals = [won(6000, '2026-07-14', 'Proposta Enviada')];
    expect(weekRevenue(deals, '2026-07-13', '2026-07-19')).toEqual({ defenz: 0, repasse: 0, defenzCount: 0, repasseCount: 0 });
  });

  it('"Contrato Enviado" conta como ganho', () => {
    const deals = [won(6000, '2026-07-14', 'Contrato Enviado')];
    expect(weekRevenue(deals, '2026-07-13', '2026-07-19')).toEqual({ defenz: 6000, repasse: 0, defenzCount: 1, repasseCount: 0 });
  });
});

describe('fonteVenda — separa Venda Defenz de Repasse SS (feature-metas-fonte-receita §3)', () => {
  it('categoria direto (ex.: Apollo) → defenz', () => {
    expect(fonteVenda({ lead_source: 'Apollo.io' })).toBe('defenz');
  });

  it('categoria parceiro (genérico, sem "ss") → defenz', () => {
    expect(fonteVenda({ lead_source: 'Parceiro XPTO' })).toBe('defenz');
  });

  it('securisoft sem tag → repasse (default conservador)', () => {
    expect(fonteVenda({ lead_source: 'Parceiro SS' })).toBe('repasse');
  });

  it('securisoft com tag "Venda Defenz" → defenz', () => {
    expect(fonteVenda({ lead_source: 'Parceiro SS', tags: 'Venda Defenz' })).toBe('defenz');
  });

  it('tag é case-insensitive e tolera espaços extras', () => {
    expect(fonteVenda({ lead_source: 'securisoft', tags: '  venda    DEFENZ  ' })).toBe('defenz');
  });

  it('tag reconhecida mesmo combinada com outras tags (lista separada por vírgula)', () => {
    expect(fonteVenda({ lead_source: 'Parceiro SS', tags: 'Cliente VIP, Venda Defenz' })).toBe('defenz');
  });

  it('sem lead_source e sem tags → default (classifyOrigin) é direto → defenz', () => {
    expect(fonteVenda({})).toBe('defenz');
  });
});

describe('weekRevenue — particiona por fonteVenda (Venda Defenz × Repasse SS)', () => {
  it('deal securisoft sem tag conta só como repasse', () => {
    const deals: RawDeal[] = [{ ...won(6000, '2026-07-14'), lead_source: 'Parceiro SS' }];
    expect(weekRevenue(deals, '2026-07-13', '2026-07-19')).toEqual({ defenz: 0, repasse: 6000, defenzCount: 0, repasseCount: 1 });
  });

  it('deal securisoft com tag "Venda Defenz" conta só como defenz', () => {
    const deals: RawDeal[] = [{ ...won(6000, '2026-07-14'), lead_source: 'Parceiro SS', tags: 'Venda Defenz' }];
    expect(weekRevenue(deals, '2026-07-13', '2026-07-19')).toEqual({ defenz: 6000, repasse: 0, defenzCount: 1, repasseCount: 0 });
  });

  it('mistura de fontes na mesma semana soma cada balde separadamente', () => {
    const deals: RawDeal[] = [
      { ...won(4000, '2026-07-14'), lead_source: 'Apollo' },                              // defenz
      { ...won(2000, '2026-07-15'), lead_source: 'Parceiro SS' },                         // repasse (sem tag)
      { ...won(1000, '2026-07-16'), lead_source: 'Parceiro SS', tags: 'venda defenz' },   // defenz (tag)
    ];
    expect(weekRevenue(deals, '2026-07-13', '2026-07-19')).toEqual({ defenz: 5000, repasse: 2000, defenzCount: 2, repasseCount: 1 });
  });
});

describe('weekRevenue counts', () => {
  it('conta deals ganhos por fonte além de somar valores', () => {
    const d0: RawDeal = { stage: 'Fechado Ganho', valor: 1000, closing_date: '2026-07-14', categoria: 'direto' };
    const d1: RawDeal = { stage: 'Fechado Ganho', valor: 500, closing_date: '2026-07-15', lead_source: 'securisoft' };
    const r = weekRevenue([d0, d1], '2026-07-13', '2026-07-19');
    expect(r.defenz).toBe(1000);
    expect(r.repasse).toBe(500);
    expect(r.defenzCount).toBe(1);
    expect(r.repasseCount).toBe(1);
  });
});

describe('weeklyEsforco — soma os campos de esforço dos dias da semana', () => {
  it('soma somente os dias dentro da janela [weekStart, weekEnd]', () => {
    const rows = [
      resumo('2026-07-12', { ligacoes_total: 100 }), // fora (domingo anterior)
      resumo('2026-07-13', { ligacoes_total: 10, emails_total: 5, apresentacoes_total: 1, propostas_total: 2, reuniao_tecnica_total: 1 }),
      resumo('2026-07-15', { ligacoes_total: 20, emails_total: 8, apresentacoes_total: 0, propostas_total: 1, reuniao_tecnica_total: 0 }),
      resumo('2026-07-20', { ligacoes_total: 999 }), // fora (semana seguinte)
    ];
    const e = weeklyEsforco(rows, '2026-07-13', '2026-07-19');
    expect(e).toEqual({ ligacoes: 30, emails: 13, apresentacoes: 1, propostas: 3, reunioes: 1 });
  });

  it('esforço conta só Seg–Sex: sábado (18/07) e domingo (19/07) são ignorados', () => {
    const rows = [
      resumo('2026-07-17', { ligacoes_total: 10 }), // sexta → conta
      resumo('2026-07-18', { ligacoes_total: 100 }), // sábado → NÃO conta no esforço
      resumo('2026-07-19', { ligacoes_total: 50 }),  // domingo → NÃO conta no esforço
    ];
    const e = weeklyEsforco(rows, '2026-07-13', '2026-07-19');
    expect(e.ligacoes).toBe(10);
  });

  it('dedupe por data: mantém só a linha com atualizado_em mais recente', () => {
    const rows = [
      resumo('2026-07-13', { ligacoes_total: 10, atualizado_em: '2026-07-13T10:00:00.000Z' } as Partial<RawResumoDiario>),
      resumo('2026-07-13', { ligacoes_total: 40, atualizado_em: '2026-07-13T18:00:00.000Z' } as Partial<RawResumoDiario>),
    ];
    const e = weeklyEsforco(rows, '2026-07-13', '2026-07-19');
    expect(e.ligacoes).toBe(40);
  });

  it('semana sem nenhum snapshot retorna tudo zero', () => {
    const e = weeklyEsforco([], '2026-07-13', '2026-07-19');
    expect(e).toEqual({ ligacoes: 0, emails: 0, apresentacoes: 0, propostas: 0, reunioes: 0 });
  });
});

describe('computeMetas — bucketização por semana ISO (Seg–Dom) + ordenação', () => {
  it('gera nWeeks semanas, mais recente primeiro, com weekStart=segunda e weekEnd=domingo', () => {
    const now = new Date('2026-07-29T15:00:00Z'); // Wed 12:00 BRT, semana 27/07–02/08
    const { semanas } = computeMetas([], [], now, 3);
    expect(semanas).toHaveLength(3);
    expect(semanas[0].weekStart).toBe('2026-07-27');
    expect(semanas[0].weekEnd).toBe('2026-08-02');
    expect(semanas[1].weekStart).toBe('2026-07-20');
    expect(semanas[1].weekEnd).toBe('2026-07-26');
    expect(semanas[2].weekStart).toBe('2026-07-13');
    expect(semanas[2].weekEnd).toBe('2026-07-19');
  });

  it('goal é sempre R$6.000 (GOAL_WEEK)', () => {
    const now = new Date('2026-07-29T15:00:00Z');
    const { semanas } = computeMetas([], [], now, 2);
    expect(semanas.every(s => s.goal === 6000)).toBe(true);
  });
});

describe('computeMetas — classificação bati/não-bati (pctAbs >= 1)', () => {
  it('semana passada completa que bateu a meta → verde/batido', () => {
    const now = new Date('2026-07-29T15:00:00Z'); // semana atual 27/07–02/08
    const deals = [won(6000, '2026-07-14')]; // semana 13–19/07 (passada, completa)
    const { semanas } = computeMetas(deals, [], now, 3);
    const passada = semanas.find(s => s.weekStart === '2026-07-13')!;
    expect(passada.pctAbs).toBe(1);
    expect(passada.cor).toBe('verde');
    expect(passada.label).toBe('batido');
  });

  it('semana passada completa bem abaixo da meta → vermelho/fora do ritmo', () => {
    const now = new Date('2026-07-29T15:00:00Z');
    const deals = [won(3000, '2026-07-22')]; // semana 20–26/07 (passada, completa), 50% da meta
    const { semanas } = computeMetas(deals, [], now, 3);
    const passada = semanas.find(s => s.weekStart === '2026-07-20')!;
    expect(passada.cor).toBe('vermelho');
    expect(passada.label).toBe('fora do ritmo');
  });

  it('semana atual em andamento, no ritmo esperado (reconcilia com o Farol Fase 1)', () => {
    // Mesmo cenário de farol.test.ts: Wed 12:00 BRT, esperado ≈2786, revenue 2500 → amarelo/atrás.
    const now = new Date('2026-07-15T15:00:00Z');
    const deals = [won(2500, '2026-07-15')];
    const { semanas } = computeMetas(deals, [], now, 1);
    expect(semanas[0].weekStart).toBe('2026-07-13');
    expect(semanas[0].cor).toBe('amarelo');
    expect(semanas[0].label).toBe('atrás');
  });
});

describe('computeMetas — a meta conta só Venda Defenz (feature-metas-fonte-receita)', () => {
  it('deal securisoft SEM tag não entra no pctAbs — vira revenueRepasse, revenue defenz fica 0', () => {
    const now = new Date('2026-07-15T15:00:00Z'); // semana 13-19/07, mesma semana do closing_date
    const deals: RawDeal[] = [{ ...won(6000, '2026-07-15'), lead_source: 'Parceiro SS' }];
    const { semanas } = computeMetas(deals, [], now, 1);
    expect(semanas[0].revenue).toBe(0);
    expect(semanas[0].revenueRepasse).toBe(6000);
    expect(semanas[0].revenueTotal).toBe(6000);
    expect(semanas[0].pctAbs).toBe(0);
    expect(semanas[0].cor).toBe('vermelho');
  });

  it('deal securisoft COM tag "Venda Defenz" entra no pctAbs normalmente', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const deals: RawDeal[] = [{ ...won(6000, '2026-07-15'), lead_source: 'Parceiro SS', tags: 'Venda Defenz' }];
    const { semanas } = computeMetas(deals, [], now, 1);
    expect(semanas[0].revenue).toBe(6000);
    expect(semanas[0].revenueRepasse).toBe(0);
    expect(semanas[0].revenueTotal).toBe(6000);
    expect(semanas[0].pctAbs).toBe(1);
  });

  it('mistura defenz + repasse: revenue = só defenz, revenueTotal = soma de tudo', () => {
    const now = new Date('2026-07-15T15:00:00Z');
    const deals: RawDeal[] = [
      { ...won(4000, '2026-07-15'), lead_source: 'Apollo' },                            // defenz
      { ...won(2500, '2026-07-15'), lead_source: 'Parceiro SS' },                       // repasse
    ];
    const { semanas } = computeMetas(deals, [], now, 1);
    expect(semanas[0].revenue).toBe(4000);
    expect(semanas[0].revenueRepasse).toBe(2500);
    expect(semanas[0].revenueTotal).toBe(6500);
  });
});

describe('computeMetas — deltas vs semana anterior', () => {
  const now = new Date('2026-07-29T15:00:00Z'); // semana atual 27/07–02/08
  const deals: RawDeal[] = [
    won(6000, '2026-07-28'), // semana atual (27/07-02/08)
    won(3000, '2026-07-22'), // semana 20-26/07
    won(6000, '2026-07-14'), // semana 13-19/07
  ];
  const resumoRows: RawResumoDiario[] = [
    resumo('2026-07-27', { ligacoes_total: 10, emails_total: 30, apresentacoes_total: 1, propostas_total: 0, reuniao_tecnica_total: 0 }), // semana atual
    resumo('2026-07-20', { ligacoes_total: 40, emails_total: 20, apresentacoes_total: 4, propostas_total: 4, reuniao_tecnica_total: 2 }), // semana 20-26
    resumo('2026-07-13', { ligacoes_total: 50, emails_total: 25, apresentacoes_total: 5, propostas_total: 10, reuniao_tecnica_total: 3 }), // semana 13-19
  ];

  it('semana mais antiga da janela não tem semana anterior → deltas null', () => {
    const { semanas } = computeMetas(deals, resumoRows, now, 3);
    const maisAntiga = semanas[2];
    expect(maisAntiga.weekStart).toBe('2026-07-13');
    expect(maisAntiga.delta).toEqual({
      revenue: null, ligacoes: null, emails: null, apresentacoes: null, propostas: null, reunioes: null,
    });
  });

  it('propostas caem 60% da semana 13-19 pra semana 20-26', () => {
    const { semanas } = computeMetas(deals, resumoRows, now, 3);
    const semana2026 = semanas.find(s => s.weekStart === '2026-07-20')!;
    expect(semana2026.delta.propostas).toBeCloseTo(-0.6, 5);
    expect(semana2026.delta.ligacoes).toBeCloseTo(-0.2, 5);
  });

  it('receita da semana atual dobrou vs a anterior (delta.revenue = +1.0)', () => {
    const { semanas } = computeMetas(deals, resumoRows, now, 3);
    const atual = semanas[0];
    expect(atual.revenue).toBe(6000);
    expect(atual.delta.revenue).toBeCloseTo(1.0, 5); // 6000 vs 3000 = +100%
  });
});

describe('computeMetas — diagnóstico "por que bati/não bati"', () => {
  const now = new Date('2026-07-29T15:00:00Z');
  const deals: RawDeal[] = [
    won(6000, '2026-07-28'), // semana atual → bateu
    won(3000, '2026-07-22'), // semana 20-26 → não bateu
    won(6000, '2026-07-14'), // semana 13-19 → bateu, mas é a mais antiga (sem anterior)
  ];
  const resumoRows: RawResumoDiario[] = [
    resumo('2026-07-27', { ligacoes_total: 10, emails_total: 30, apresentacoes_total: 1, propostas_total: 0, reuniao_tecnica_total: 0 }),
    resumo('2026-07-20', { ligacoes_total: 40, emails_total: 20, apresentacoes_total: 4, propostas_total: 4, reuniao_tecnica_total: 2 }),
    resumo('2026-07-13', { ligacoes_total: 50, emails_total: 25, apresentacoes_total: 5, propostas_total: 10, reuniao_tecnica_total: 3 }),
  ];

  it('quando bateu, aponta o campo que mais subiu vs a semana anterior', () => {
    const { semanas } = computeMetas(deals, resumoRows, now, 3);
    const atual = semanas[0]; // bateu, emails subiu de 20->30 (+50%), demais caíram
    expect(atual.label).toBe('batido');
    expect(atual.diagnostico).toMatch(/Emails subiu 50%/);
  });

  it('quando não bateu, aponta o(s) campo(s) que mais caíram vs a semana anterior', () => {
    const { semanas } = computeMetas(deals, resumoRows, now, 3);
    const naoBateu = semanas.find(s => s.weekStart === '2026-07-20')!; // propostas -60%, o maior tombo
    expect(naoBateu.pctAbs).toBeLessThan(1);
    expect(naoBateu.diagnostico).toMatch(/Propostas caiu 60%/);
  });

  it('sem semana anterior, o diagnóstico é neutro (não quebra)', () => {
    const { semanas } = computeMetas(deals, resumoRows, now, 3);
    const maisAntiga = semanas[2];
    expect(maisAntiga.diagnostico.length).toBeGreaterThan(0);
    expect(maisAntiga.diagnostico).toMatch(/sem semana anterior/i);
  });
});

describe('computeMetas — consolidado (somatório das semanas da janela)', () => {
  const now = new Date('2026-07-29T15:00:00Z'); // Wed, semana atual 27/07–02/08
  const deals: RawDeal[] = [
    won(6000, '2026-07-28'), // semana atual 27/07–02/08 (defenz)
    won(3000, '2026-07-22'), // semana 20–26/07
    won(6000, '2026-07-14'), // semana 13–19/07
  ];
  const resumoRows: RawResumoDiario[] = [
    resumo('2026-07-27', { ligacoes_total: 10, emails_total: 30 }),
    resumo('2026-07-20', { ligacoes_total: 40, emails_total: 20 }),
    resumo('2026-07-13', { ligacoes_total: 50, emails_total: 25 }),
  ];

  it('soma receita e esforço de todas as semanas da janela', () => {
    const { consolidado } = computeMetas(deals, resumoRows, now, 3);
    expect(consolidado.nWeeks).toBe(3);
    expect(consolidado.revenue).toBe(15000);          // 6000 + 3000 + 6000
    expect(consolidado.goal).toBe(18000);             // 6000 × 3
    expect(consolidado.esforco.ligacoes).toBe(100);   // 10 + 40 + 50
    expect(consolidado.esforco.emails).toBe(75);      // 30 + 20 + 25
  });

  it('a janela vai da segunda mais antiga ao domingo mais recente', () => {
    const { consolidado } = computeMetas(deals, resumoRows, now, 3);
    expect(consolidado.weekStart).toBe('2026-07-13'); // segunda da mais antiga
    expect(consolidado.weekEnd).toBe('2026-08-02');   // domingo da atual
  });

  it('separa Venda Defenz de Repasse SS no consolidado', () => {
    const mix: RawDeal[] = [
      { ...won(4000, '2026-07-28'), lead_source: 'Apollo' },        // defenz
      { ...won(2000, '2026-07-22'), lead_source: 'Parceiro SS' },   // repasse
    ];
    const { consolidado } = computeMetas(mix, [], now, 3);
    expect(consolidado.revenue).toBe(4000);
    expect(consolidado.revenueRepasse).toBe(2000);
    expect(consolidado.revenueTotal).toBe(6000);
  });
});

describe('computeEficiencia', () => {
  const esf = { ligacoes: 400, emails: 0, apresentacoes: 0, propostas: 20, reunioes: 60 };
  it('calcula índices e null quando denominador zero', () => {
    const r = computeEficiencia({ receita: 40000, deals: 4, esforco: esf },
                                { receita: 30000, deals: 5, esforco: { ...esf, propostas: 25 } }, 'vs 8 semanas anteriores');
    expect(r.atual.ticketMedio).toBe(10000);
    expect(r.atual.rsPorProposta).toBe(2000);
    expect(r.atual.propostasPor100Ligacoes).toBe(5);
    expect(r.atual.reuniaoParaProposta).toBeCloseTo(20 / 60);
  });
  it('suprime delta quando amostra < 3', () => {
    const r = computeEficiencia({ receita: 10000, deals: 1, esforco: esf },
                                { receita: 9000, deals: 2, esforco: esf }, 'vs junho');
    expect(r.delta.ticketMedio).toBeNull(); // deals 1 e 2 < 3
  });
});

describe('computeMetas — modo intervalo (range de semanas)', () => {
  const now = new Date('2026-07-29T15:00:00Z');

  it('gera as semanas cujas segundas caem em [from, to], mais recente primeiro', () => {
    // range cobre segundas 06/07 e 13/07 → 2 semanas
    const { semanas } = computeMetas([], [], now, 8, { from: '2026-07-06', to: '2026-07-19' });
    expect(semanas).toHaveLength(2);
    expect(semanas[0].weekStart).toBe('2026-07-13');
    expect(semanas[1].weekStart).toBe('2026-07-06');
  });

  it('consolidado do intervalo usa meta = R$6k × nº de semanas do intervalo', () => {
    const { consolidado } = computeMetas([], [], now, 8, { from: '2026-07-06', to: '2026-07-19' });
    expect(consolidado.nWeeks).toBe(2);
    expect(consolidado.goal).toBe(12000);
  });

  it('um único dia dentro de uma semana resolve para aquela semana', () => {
    const { semanas } = computeMetas([], [], now, 8, { from: '2026-07-15', to: '2026-07-15' });
    expect(semanas).toHaveLength(1);
    expect(semanas[0].weekStart).toBe('2026-07-13');
    expect(semanas[0].weekEnd).toBe('2026-07-19');
  });
});
