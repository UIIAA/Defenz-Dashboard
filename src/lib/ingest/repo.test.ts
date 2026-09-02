import { describe, it, expect } from 'vitest';
import { TABELAS, camposDaTabela, validarLote } from './schema';
import { camposConsumidos, sqlDoLote, classificarOrfaos } from './repo';

// ESTE É O TESTE QUE A SPEC PEDE (§Decisões 2): o bug do `licencas` foi uma coluna
// validada em um lado e DESCARTADA no outro, em silêncio. Aqui, esquecer de gravar
// um campo que o schema valida quebra o build de testes — não vira número errado.
describe('nenhum campo validado pode ser descartado na gravação', () => {
  for (const tabela of TABELAS) {
    it(`${tabela}: campos do schema == campos consumidos pelo SQL`, () => {
      expect([...camposConsumidos(tabela)].sort()).toEqual([...camposDaTabela(tabela)].sort());
    });
  }
});

describe('SQL do lote', () => {
  it('deals: upsert idempotente por id, com FK de empresa resolvida por nome_norm', () => {
    const sql = sqlDoLote('deals').join('\n');
    expect(sql).toContain('on conflict (id) do update');
    expect(sql).toContain('left join empresas e on e.nome_norm = r.empresa_norm');
    expect(sql).toContain('insert into empresas');
  });

  it('deals: tags viram linhas (substituição completa por deal)', () => {
    const sql = sqlDoLote('deals').join('\n');
    expect(sql).toContain('delete from deal_tags');
    expect(sql).toContain('insert into deal_tags');
  });

  it('classificacao_ia: conflito na chave composta preserva o histórico', () => {
    expect(sqlDoLote('classificacao_ia').join('\n')).toContain(
      'on conflict (lead_id, data_classificacao) do update'
    );
  });

  it('toda tabela reporta inserido-vs-atualizado (xmax=0) na última instrução', () => {
    for (const tabela of TABELAS) {
      const stmts = sqlDoLote(tabela);
      expect(stmts.some((s) => s.includes('(xmax = 0) as inserido'))).toBe(true);
    }
  });

  it('nenhuma instrução interpola valor — tudo vai por parâmetro $1', () => {
    for (const tabela of TABELAS) {
      for (const stmt of sqlDoLote(tabela)) {
        expect(stmt).toContain('$1::jsonb');
        expect(stmt).not.toMatch(/\$[2-9]/);
      }
    }
  });
});

// Achado do backfill de 28/07: 145 das 279 tarefas da aba `agenda` apontam pra um
// lead que NÃO existe na aba `leads` (todas com lead_status "-"). Rejeitar a linha
// inteira jogaria fora metade da agenda — sendo que a tarefa (assunto, prazo, dono)
// é dado válido por si. Já uma classificação SEM lead não significa nada: o lead é o
// sujeito do registro, e ainda é metade da chave natural.
describe('classificarOrfaos', () => {
  const existentes = new Set(['l1']);

  it('agenda: guarda a linha com lead_id nulo e conta como órfã', () => {
    const linhas = [
      { task_id: 't1', lead_id: 'l1', _i: 0 },
      { task_id: 't2', lead_id: 'desconhecido', _i: 1 },
    ];
    const r = classificarOrfaos('agenda', linhas, existentes);
    expect(r.gravaveis).toHaveLength(2);
    expect(r.gravaveis[1]).toMatchObject({ task_id: 't2', lead_id: null });
    expect(r.orfaos).toBe(1);
    expect(r.erros).toEqual([]);
  });

  it('classificacao_ia: rejeita e reporta linha e motivo', () => {
    const linhas = [
      { lead_id: 'l1', data_classificacao: 'x', _i: 0 },
      { lead_id: 'sumiu', data_classificacao: 'y', _i: 1 },
    ];
    const r = classificarOrfaos('classificacao_ia', linhas, existentes);
    expect(r.gravaveis).toHaveLength(1);
    expect(r.orfaos).toBe(1);
    expect(r.erros).toEqual([
      { linha: 1, campo: 'lead_id', motivo: 'lead sumiu ainda não ingerido' },
    ]);
  });

  it('lead_id vazio não é órfão — é tarefa sem lead', () => {
    const r = classificarOrfaos('agenda', [{ task_id: 't', lead_id: null, _i: 0 }], existentes);
    expect(r.gravaveis).toHaveLength(1);
    expect(r.orfaos).toBe(0);
  });

  it('tabela sem dependência de lead passa intacta', () => {
    const linhas = [{ id: 'd1', lead_id: 'nada a ver' }];
    const r = classificarOrfaos('deals', linhas, new Set());
    expect(r.gravaveis).toEqual(linhas);
    expect(r.orfaos).toBe(0);
  });
});

describe('a linha validada alimenta o recordset sem sobra', () => {
  it('deals: as chaves da linha validada estão todas declaradas no recordset', () => {
    const { validas } = validarLote('deals', [
      { id: '1', nome: 'n', stage: 's', valor: 1, licencas: 2, empresa: 'ACME', tags: 'a,b' },
    ]);
    const declaradas = new Set(camposConsumidos('deals'));
    for (const chave of Object.keys(validas[0])) {
      if (chave.startsWith('_')) continue; // metadado interno (índice da linha)
      expect(declaradas.has(chave)).toBe(true);
    }
  });
});

// --- feature-040 §pedido 4 · a marca de Grande Conta é durável ---
describe('grande_conta é sticky no upsert', () => {
  it('o on conflict faz OR com o valor que já está na tabela, não sobrescreve', () => {
    const sql = sqlDoLote('deals').join('\n');
    expect(sql).toContain('grande_conta = deals.grande_conta or excluded.grande_conta');
  });

  it('nenhuma outra coluna virou sticky por acidente', () => {
    const sql = sqlDoLote('deals').join('\n');
    expect(sql).toContain('stage = excluded.stage');
    expect(sql).toContain('valor = excluded.valor');
  });
});
