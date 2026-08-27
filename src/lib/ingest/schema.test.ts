import { describe, it, expect } from 'vitest';
import {
  validarLote,
  TABELAS,
  isTabela,
  origensDaTabela,
  COLUNAS_ROW_VALUES,
  linhaDeRowValues,
} from './schema';

describe('tabelas suportadas', () => {
  it('são as 7 da primeira onda', () => {
    expect(TABELAS).toEqual([
      'deals',
      'ligacoes',
      'emails',
      'leads',
      'classificacao_ia',
      'agenda',
      'resumo_diario',
    ]);
  });

  it('isTabela rejeita nome desconhecido', () => {
    expect(isTabela('deals')).toBe(true);
    expect(isTabela('metricas')).toBe(false);
  });
});

describe('deals', () => {
  const linha = {
    id: '123',
    nome: 'Defenz <> Infracommerce',
    empresa: ' Infracommerce ',
    stage: 'Fechado Ganho',
    valor: 12500.5,
    lead_source: 'Parceiro SS',
    categoria: 'securisoft',
    comissao_valor: 625.03,
    licencas: 40,
    created_time: '2026-07-01',
    modified_time: '2026-07-28',
    closing_date: '2026-07-20',
    resultados: '[APRESENTACAO] 2026-07-05',
    tags: 'Setup Concluido, Na Console',
  };

  it('aceita a linha típica e normaliza empresa + tags', () => {
    const r = validarLote('deals', [linha]);
    expect(r.erros).toEqual([]);
    expect(r.validas[0]).toMatchObject({
      id: '123',
      empresa_norm: 'INFRACOMMERCE',
      empresa_exibicao: 'Infracommerce',
      stage: 'Fechado Ganho',
      valor: 12500.5,
      licencas: 40,
      closing_date: '2026-07-20',
      tags: ['Setup Concluido', 'Na Console'],
    });
  });

  it('rejeita linha sem id em vez de inventar chave', () => {
    const r = validarLote('deals', [{ ...linha, id: '' }]);
    expect(r.validas).toEqual([]);
    expect(r.erros).toEqual([{ linha: 0, campo: 'id', motivo: 'obrigatório' }]);
  });

  it('rejeita número com lixo em vez de coagir pra 0', () => {
    const r = validarLote('deals', [{ ...linha, valor: 'R$ 12.500,50' }]);
    expect(r.validas).toEqual([]);
    expect(r.erros[0]).toMatchObject({ linha: 0, campo: 'valor' });
  });

  it('valor ausente vira 0 (é o default da coluna, não coerção de lixo)', () => {
    const r = validarLote('deals', [{ ...linha, valor: null }]);
    expect(r.erros).toEqual([]);
    expect(r.validas[0].valor).toBe(0);
  });

  it('rejeita data malformada em vez de virar null', () => {
    const r = validarLote('deals', [{ ...linha, closing_date: '20/07/2026' }]);
    expect(r.validas).toEqual([]);
    expect(r.erros[0]).toMatchObject({ linha: 0, campo: 'closing_date' });
  });

  it('rejeita data inexistente no calendário', () => {
    const r = validarLote('deals', [{ ...linha, closing_date: '2026-02-30' }]);
    expect(r.erros[0]).toMatchObject({ campo: 'closing_date' });
  });

  it('data vazia é permitida (deal em aberto não tem closing_date)', () => {
    const r = validarLote('deals', [{ ...linha, closing_date: '' }]);
    expect(r.erros).toEqual([]);
    expect(r.validas[0].closing_date).toBeNull();
  });

  it('rejeita categoria fora do check constraint', () => {
    const r = validarLote('deals', [{ ...linha, categoria: 'indireto' }]);
    expect(r.erros[0]).toMatchObject({ campo: 'categoria' });
  });

  it('licenças fracionadas são lixo — rejeita', () => {
    const r = validarLote('deals', [{ ...linha, licencas: 3.5 }]);
    expect(r.erros[0]).toMatchObject({ campo: 'licencas' });
  });

  it('deduplica chave repetida no lote mantendo a última (PK não aceita duas)', () => {
    const r = validarLote('deals', [linha, { ...linha, stage: 'Contrato Enviado' }]);
    expect(r.validas).toHaveLength(1);
    expect(r.validas[0].stage).toBe('Contrato Enviado');
    expect(r.duplicados).toBe(1);
  });
});

describe('ligacoes', () => {
  const linha = {
    call_id: 'c1',
    data: '2026-07-28',
    hora: '09:15',
    agente: 'Gustavo',
    destino: '11999998888',
    duracao_seg: 42,
    status: 'atendida',
    disposicao: 'ANSWERED',
  };

  it('aceita e normaliza hora pra HH:MM:SS', () => {
    const r = validarLote('ligacoes', [linha]);
    expect(r.erros).toEqual([]);
    expect(r.validas[0]).toMatchObject({
      call_id: 'c1',
      data: '2026-07-28',
      hora: '09:15:00',
      agente_norm: 'GUSTAVO',
      duracao_seg: 42,
    });
  });

  it('data é obrigatória (é o eixo de toda métrica)', () => {
    const r = validarLote('ligacoes', [{ ...linha, data: '' }]);
    expect(r.erros[0]).toMatchObject({ campo: 'data', motivo: 'obrigatório' });
  });

  it('rejeita hora malformada', () => {
    const r = validarLote('ligacoes', [{ ...linha, hora: '25:99' }]);
    expect(r.erros[0]).toMatchObject({ campo: 'hora' });
  });
});

describe('emails', () => {
  it('aceita a linha típica', () => {
    const r = validarLote('emails', [
      {
        email_id: 'e1',
        data: '2026-07-28',
        hora: '10:00:00',
        destinatario: 'x@y.com',
        destinatario_nome: 'X',
        assunto: 'Oi',
        status: 'sent',
        sequencia: 'Seq 1',
      },
    ]);
    expect(r.erros).toEqual([]);
    expect(r.validas[0]).toMatchObject({ email_id: 'e1', data: '2026-07-28' });
  });
});

describe('leads', () => {
  it('normaliza empresa e owner como dimensões', () => {
    const r = validarLote('leads', [
      {
        lead_id: 'l1',
        nome: 'Fulano',
        empresa: 'Vivo  S.A.',
        owner: ' Gustavo ',
        lead_source: 'Apollo',
        lead_status: 'Contatado',
        telefone: '11999998888',
        email: 'f@vivo.com',
        resultados: '',
        created_time: '2026-06-01',
        modified_time: '2026-07-01',
      },
    ]);
    expect(r.erros).toEqual([]);
    expect(r.validas[0]).toMatchObject({
      lead_id: 'l1',
      empresa_norm: 'VIVO S.A.',
      owner_norm: 'GUSTAVO',
    });
  });
});

describe('classificacao_ia', () => {
  const linha = {
    lead_id: 'l1',
    data_classificacao: '2026-07-28T12:00:00Z',
    nivel_maximo: 'N3',
    passou_secretaria: 'sim',
    resultado_principal: 'Reunião marcada',
    concorrente: 'Kaspersky',
    renovacao_concorrente: '2026-12-01',
    toques_estimados: 4,
    pessoa_contactada: 'TI',
    cargo_estimado: 'Gerente',
    resumo: 'Ok',
  };

  it('aceita e converte passou_secretaria pra boolean', () => {
    const r = validarLote('classificacao_ia', [linha]);
    expect(r.erros).toEqual([]);
    expect(r.validas[0]).toMatchObject({
      lead_id: 'l1',
      passou_secretaria: true,
      toques_estimados: 4,
    });
  });

  it('a chave é (lead_id, data_classificacao) — preserva histórico do mesmo lead', () => {
    const r = validarLote('classificacao_ia', [
      linha,
      { ...linha, data_classificacao: '2026-07-29T12:00:00Z' },
    ]);
    expect(r.validas).toHaveLength(2);
    expect(r.duplicados).toBe(0);
  });

  it('rejeita data_classificacao ausente (sem ela não há chave)', () => {
    const r = validarLote('classificacao_ia', [{ ...linha, data_classificacao: '' }]);
    expect(r.erros[0]).toMatchObject({ campo: 'data_classificacao', motivo: 'obrigatório' });
  });
});

describe('o fonte não pode conter byte NUL cru', () => {
  it('mantém o separador do dedup escrito como escape', async () => {
    // Um NUL literal no fonte faz o `grep` tratar o arquivo como BINÁRIO e devolver zero
    // resultados em silêncio, com exit 1. Custou tempo a duas sessões em 27/08/2026 antes de
    // alguém descobrir por que a busca não achava nada neste arquivo.
    const { readFile } = await import('node:fs/promises');
    const fonte = await readFile(new URL('./schema.ts', import.meta.url), 'utf8');
    expect(fonte.includes(String.fromCharCode(0))).toBe(false);
  });
});

describe('agenda', () => {
  it('aceita e converte is_overdue "sim"', () => {
    const r = validarLote('agenda', [
      {
        task_id: 't1',
        lead_id: 'l1',
        lead_name: 'Fulano',
        empresa: 'Vivo',
        subject: 'Ligar',
        due_date: '2026-07-30',
        status: 'Not Started',
        description: '',
        owner: 'Gustavo',
        is_overdue: 'sim',
        lead_status: 'Contatado',
      },
    ]);
    expect(r.erros).toEqual([]);
    expect(r.validas[0]).toMatchObject({ task_id: 't1', is_overdue: true, owner_norm: 'GUSTAVO' });
  });
});

describe('resumo_diario', () => {
  const linha = {
    data: '2026-07-28',
    atualizado_em: '2026-07-28T20:00:00Z',
    mode: 'live',
    coverage: '{"ligacoes_fresh":true}',
    ligacoes_total: 320,
    ligacoes_atendidas: 88,
    ligacoes_taxa: 27.5,
    ligacoes_por_vendedor: '{"Gustavo":{"realizadas":200,"atendidas":50}}',
    emails_total: 120,
    emails_por_sender: '{"Gustavo":120}',
    apresentacoes_total: 2,
    apresentacoes_por_vendedor: '{}',
    propostas_total: 1,
    propostas_por_vendedor: '{}',
    reuniao_tecnica_total: 0,
    reuniao_por_vendedor: '{}',
    whatsapp_msgs: 10,
    whatsapp_convs: 3,
    linkedin_page: 5,
    linkedin_perfis: 2,
    pocs_ativas: 1,
    pocs_lista: '["ACME"]',
    base_total_licencas: 5000,
    base_clientes_ativos: 42,
    base_top_contas: '[{"name":"ACME","licencas":900}]',
    base_demais_count: 30,
    base_demais_licencas: 1200,
    total_tracao: 455,
    destaque_comercial: 'Fechou ACME',
    destaque_marketing: '',
    destaque_execucao: '',
    destaque_atencao: '',
  };

  it('parseia as colunas JSON pra estrutura (viram jsonb)', () => {
    const r = validarLote('resumo_diario', [linha]);
    expect(r.erros).toEqual([]);
    const v = r.validas[0];
    expect(v.por_vendedor).toEqual({
      ligacoes: { Gustavo: { realizadas: 200, atendidas: 50 } },
      emails: { Gustavo: 120 },
      apresentacoes: {},
      propostas: {},
      reuniao: {},
    });
    expect(v.base_top_contas).toEqual([{ name: 'ACME', licencas: 900 }]);
    expect(v.destaques).toEqual({
      comercial: 'Fechou ACME',
      marketing: null,
      execucao: null,
      atencao: null,
    });
    expect(v.ligacoes_taxa).toBe(27.5);
  });

  it('rejeita JSON quebrado em vez de gravar null silencioso', () => {
    const r = validarLote('resumo_diario', [{ ...linha, pocs_lista: '[ACME' }]);
    expect(r.validas).toEqual([]);
    expect(r.erros[0]).toMatchObject({ campo: 'pocs_lista' });
  });

  it('a data é a PK — sem ela a linha é rejeitada', () => {
    const r = validarLote('resumo_diario', [{ ...linha, data: null }]);
    expect(r.erros[0]).toMatchObject({ campo: 'data', motivo: 'obrigatório' });
  });
});

// O nó `Build Row` do workflow n8n `aMhvdTP5aAi0Z1sf` (Snapshot Diário) emite um ARRAY
// posicional de 32 células, não um objeto. Posição é exatamente o tipo de contrato que
// quebra em silêncio quando alguém insere uma coluna no meio. Aqui ele vira teste.
describe('contrato posicional do resumo_diario (n8n Build Row)', () => {
  it('as 32 posições cobrem exatamente as origens que o schema declara', () => {
    expect([...COLUNAS_ROW_VALUES].sort()).toEqual([...origensDaTabela('resumo_diario')].sort());
  });

  it('a ordem é a do Build Row: data primeiro, destaque_atencao por último', () => {
    expect(COLUNAS_ROW_VALUES).toHaveLength(32);
    expect(COLUNAS_ROW_VALUES[0]).toBe('data');
    expect(COLUNAS_ROW_VALUES[3]).toBe('coverage');
    expect(COLUNAS_ROW_VALUES[27]).toBe('total_tracao');
    expect(COLUNAS_ROW_VALUES[31]).toBe('destaque_atencao');
  });

  it('linhaDeRowValues converte o array em objeto nomeado', () => {
    const row = new Array(32).fill('');
    row[0] = '2026-07-28';
    row[4] = 320;
    row[31] = 'Cuidado com X';
    const linha = linhaDeRowValues(row);
    expect(linha.data).toBe('2026-07-28');
    expect(linha.ligacoes_total).toBe(320);
    expect(linha.destaque_atencao).toBe('Cuidado com X');
  });

  it('array de tamanho errado é erro explícito, não linha meio preenchida', () => {
    expect(() => linhaDeRowValues([1, 2, 3])).toThrow(/32/);
  });

  it('a linha convertida passa pela validação sem rejeição', () => {
    const row = new Array(32).fill('');
    row[0] = '2026-07-28';
    row[1] = '2026-07-28T20:00:00Z';
    row[2] = 'live';
    row[4] = 320;
    const { validas, erros } = validarLote('resumo_diario', [linhaDeRowValues(row)]);
    expect(erros).toEqual([]);
    expect(validas[0]).toMatchObject({ data: '2026-07-28', ligacoes_total: 320, emails_total: null });
  });
});

describe('lote', () => {
  it('uma linha ruim não derruba as boas — reporta o índice de cada erro', () => {
    const bom = { email_id: 'e1', data: '2026-07-28' };
    const ruim = { email_id: 'e2', data: 'ontem' };
    const r = validarLote('emails', [bom, ruim, { ...bom, email_id: 'e3' }]);
    expect(r.validas.map((v) => v.email_id)).toEqual(['e1', 'e3']);
    expect(r.erros).toEqual([{ linha: 1, campo: 'data', motivo: 'data inválida (esperado YYYY-MM-DD)' }]);
  });

  it('rejeita item que não é objeto', () => {
    const r = validarLote('emails', ['nope' as unknown as Record<string, unknown>]);
    expect(r.erros[0]).toMatchObject({ linha: 0, campo: '_linha' });
  });
});
