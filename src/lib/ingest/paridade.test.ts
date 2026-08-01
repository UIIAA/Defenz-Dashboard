import { describe, it, expect } from 'vitest';
import {
  resumirSheets,
  compararResumos,
  paresUnificados,
  diasUteisFaltando,
  avaliarDiasUteis,
  BASELINE,
  type DivergenciaConhecida,
} from './paridade';

describe('resumirSheets — deals', () => {
  const deals = [
    { id: '1', stage: 'Fechado Ganho', valor: 1000, licencas: 10 },
    { id: '2', stage: 'Contrato Enviado', valor: '2000.5', licencas: '5' },
    { id: '3', stage: 'Proposta Enviada', valor: 500, licencas: 0 },
  ];

  it('conta, soma valor/licenças e conta ganhos como o dashboard conta', () => {
    expect(resumirSheets('deals', deals)).toEqual({
      contagem: 3,
      soma_valor: 3500.5,
      soma_licencas: 15,
      ganhos: 2, // "Contrato Enviado" também é ganho (isClosedWon)
    });
  });
});

describe('resumirSheets — ligacoes/emails', () => {
  it('soma duração e devolve o intervalo de datas', () => {
    const calls = [
      { call_id: 'a', data: '2026-07-02', duracao_seg: 30 },
      { call_id: 'b', data: '2026-07-01', duracao_seg: '12' },
    ];
    expect(resumirSheets('ligacoes', calls)).toEqual({
      contagem: 2,
      soma_duracao: 42,
      data_min: '2026-07-01',
      data_max: '2026-07-02',
    });
  });

  it('emails: contagem + intervalo', () => {
    expect(resumirSheets('emails', [{ email_id: 'e', data: '2026-07-03' }])).toEqual({
      contagem: 1,
      data_min: '2026-07-03',
      data_max: '2026-07-03',
    });
  });

  it('lote vazio devolve intervalo null, não string vazia', () => {
    expect(resumirSheets('emails', [])).toEqual({
      contagem: 0,
      data_min: null,
      data_max: null,
    });
  });
});

describe('resumirSheets — demais', () => {
  it('classificacao_ia compara lead_id DISTINTOS (a tabela é append-only)', () => {
    const rows = [
      { lead_id: 'l1', data_classificacao: '2026-07-01T00:00:00Z' },
      { lead_id: 'l1', data_classificacao: '2026-07-02T00:00:00Z' },
      { lead_id: 'l2', data_classificacao: '2026-07-02T00:00:00Z' },
    ];
    expect(resumirSheets('classificacao_ia', rows)).toEqual({ leads_distintos: 2 });
  });

  it('leads e agenda só contam', () => {
    expect(resumirSheets('leads', [{ lead_id: 'a' }])).toEqual({ contagem: 1 });
    expect(resumirSheets('agenda', [{ task_id: 't' }])).toEqual({ contagem: 1 });
  });

  it('resumo_diario conta dias e o intervalo', () => {
    expect(resumirSheets('resumo_diario', [{ data: '2026-07-01' }, { data: '2026-07-02' }])).toEqual({
      contagem: 2,
      data_min: '2026-07-01',
      data_max: '2026-07-02',
    });
  });
});

describe('compararResumos', () => {
  it('igual em tudo → verde', () => {
    const r = compararResumos('leads', { contagem: 10 }, { contagem: 10 });
    expect(r.veredito).toBe('verde');
    expect(r.checagens).toEqual([
      { nome: 'contagem', neon: 10, sheets: 10, ok: true, status: 'ok', delta: 0 },
    ]);
  });

  it('qualquer divergência → vermelho, com o delta explícito', () => {
    const r = compararResumos('deals',
      { contagem: 9, soma_valor: 100, soma_licencas: 5, ganhos: 2 },
      { contagem: 10, soma_valor: 100, soma_licencas: 5, ganhos: 2 }
    );
    expect(r.veredito).toBe('vermelho');
    expect(r.checagens.find((c) => c.nome === 'contagem')).toMatchObject({ ok: false, delta: -1 });
    expect(r.checagens.filter((c) => !c.ok)).toHaveLength(1);
  });

  it('dinheiro compara com 2 casas — float não gera falso vermelho', () => {
    const r = compararResumos('deals',
      { contagem: 1, soma_valor: 3500.499999999, soma_licencas: 0, ganhos: 0 },
      { contagem: 1, soma_valor: 3500.5, soma_licencas: 0, ganhos: 0 }
    );
    expect(r.veredito).toBe('verde');
  });

  it('datas divergentes acusam sem delta numérico', () => {
    const r = compararResumos('emails',
      { contagem: 1, data_min: '2026-07-02', data_max: '2026-07-03' },
      { contagem: 1, data_min: '2026-07-01', data_max: '2026-07-03' }
    );
    expect(r.veredito).toBe('vermelho');
    expect(r.checagens.find((c) => c.nome === 'data_min')).toMatchObject({
      ok: false,
      neon: '2026-07-02',
      sheets: '2026-07-01',
      delta: null,
    });
  });
});

// O baseline é a saída da INVESTIGAÇÃO, não um jeito de calar o portão: cada entrada
// tem o delta EXATO, a data e o motivo apurado. A propriedade que vale é a de baixo —
// desviou do baseline, mesmo que por 1, volta a vermelho.
describe('baseline de divergências conhecidas', () => {
  const baseline: DivergenciaConhecida[] = [
    {
      tabela: 'ligacoes',
      checagem: 'contagem',
      delta: -5,
      desde: '2026-07-28',
      motivo: '3 call_id repetidos na aba',
      atestado: 'docs/ATESTADO_PARIDADE_NEON_2026-07-28.md',
    },
  ];

  it('delta que bate o baseline não bloqueia, e fica marcado como tal', () => {
    const r = compararResumos('ligacoes',
      { contagem: 11524, soma_duracao: 10, data_min: null, data_max: null },
      { contagem: 11529, soma_duracao: 10, data_min: null, data_max: null },
      baseline
    );
    expect(r.veredito).toBe('verde');
    const c = r.checagens.find((x) => x.nome === 'contagem')!;
    expect(c.ok).toBe(true);
    expect(c.status).toBe('baseline');
    expect(c.nota).toContain('3 call_id repetidos');
  });

  it('desviou do baseline por 1 → VERMELHO (é o ponto do baseline existir)', () => {
    const r = compararResumos('ligacoes',
      { contagem: 11523, soma_duracao: 10, data_min: null, data_max: null },
      { contagem: 11529, soma_duracao: 10, data_min: null, data_max: null },
      baseline
    );
    expect(r.veredito).toBe('vermelho');
    const c = r.checagens.find((x) => x.nome === 'contagem')!;
    expect(c.status).toBe('divergente');
    expect(c.nota).toContain('esperado -5');
  });

  it('divergência sem baseline continua vermelha', () => {
    const r = compararResumos('ligacoes',
      { contagem: 11524, soma_duracao: 99, data_min: null, data_max: null },
      { contagem: 11529, soma_duracao: 10, data_min: null, data_max: null },
      baseline
    );
    expect(r.veredito).toBe('vermelho');
    expect(r.checagens.find((x) => x.nome === 'soma_duracao')!.status).toBe('divergente');
  });

  it('origem consertada (delta 0) fica verde e avisa que o baseline ficou obsoleto', () => {
    const r = compararResumos('ligacoes',
      { contagem: 11529, soma_duracao: 10, data_min: null, data_max: null },
      { contagem: 11529, soma_duracao: 10, data_min: null, data_max: null },
      baseline
    );
    expect(r.veredito).toBe('verde');
    const c = r.checagens.find((x) => x.nome === 'contagem')!;
    expect(c.status).toBe('obsoleto');
    expect(c.nota).toMatch(/remov/i);
  });

  it('sem baseline nenhum, nada muda de comportamento', () => {
    const r = compararResumos('leads', { contagem: 9 }, { contagem: 10 }, []);
    expect(r.veredito).toBe('vermelho');
    expect(r.checagens[0].status).toBe('divergente');
  });
});

describe('BASELINE de produção', () => {
  it('toda entrada carrega delta, data, motivo e o atestado que a investigou', () => {
    for (const d of BASELINE) {
      expect(Number.isFinite(d.delta)).toBe(true);
      expect(d.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.motivo.length).toBeGreaterThan(20);
      expect(d.atestado).toMatch(/^docs\//);
    }
  });

  it('é curto de propósito — baseline que cresce é portão que virou enfeite', () => {
    expect(BASELINE.length).toBeLessThanOrEqual(6);
  });
});

describe('avaliarDiasUteis', () => {
  const conhecidos = ['2026-05-22', '2026-05-25'];

  it('só os buracos conhecidos → não bloqueia', () => {
    const r = avaliarDiasUteis(['2026-05-22', '2026-05-25'], conhecidos);
    expect(r.ok).toBe(true);
    expect(r.novos).toEqual([]);
  });

  it('um dia útil NOVO sem snapshot → bloqueia e diz qual', () => {
    const r = avaliarDiasUteis(['2026-05-22', '2026-07-30'], conhecidos);
    expect(r.ok).toBe(false);
    expect(r.novos).toEqual(['2026-07-30']);
  });

  it('buraco conhecido que sumiu não bloqueia', () => {
    expect(avaliarDiasUteis([], conhecidos).ok).toBe(true);
  });
});

describe('paresUnificados — §Riscos 1', () => {
  it('mostra as variantes que colapsam na mesma empresa (achado, não erro)', () => {
    const rows = [
      { empresa: 'Infracommerce' },
      { empresa: 'INFRACOMMERCE' },
      { empresa: ' infracommerce ' },
      { empresa: 'Vivo' },
    ];
    expect(paresUnificados(rows, 'empresa')).toEqual([
      { nome_norm: 'INFRACOMMERCE', variantes: ['Infracommerce', 'INFRACOMMERCE', 'infracommerce'] },
    ]);
  });

  it('sem colapso → lista vazia', () => {
    expect(paresUnificados([{ empresa: 'Vivo' }, { empresa: 'Claro' }], 'empresa')).toEqual([]);
  });
});

describe('diasUteisFaltando', () => {
  it('aponta o dia útil sem snapshot e ignora fim de semana', () => {
    // 2026-07-01 qua … 2026-07-06 seg. 04 sex faltando; 04? (sáb/dom fora)
    const datas = ['2026-07-01', '2026-07-02', '2026-07-06'];
    expect(diasUteisFaltando(datas, '2026-07-01', '2026-07-06')).toEqual(['2026-07-03']);
  });

  it('todos presentes → vazio', () => {
    expect(diasUteisFaltando(['2026-07-01'], '2026-07-01', '2026-07-01')).toEqual([]);
  });

  it('intervalo só de fim de semana nunca falta', () => {
    expect(diasUteisFaltando([], '2026-07-04', '2026-07-05')).toEqual([]);
  });
});
