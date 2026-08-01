// feature-migracao-neon (Fase 1) — teste de INTEGRAÇÃO do SQL contra um Postgres real.
//
// Os testes unitários provam a forma dos dados; este prova que o DDL e o DML
// realmente RODAM (tipos, FKs, `on conflict`, idempotência). Sem ele, um erro de
// coluna só apareceria em produção — que é exatamente a classe de bug que a spec ataca.
//
// PULA por padrão. Pra rodar, suba um Postgres descartável e aponte PGTEST_URL:
//
//   initdb -D /tmp/pgdata -U postgres --auth=trust
//   pg_ctl -D /tmp/pgdata -o "-p 55432 -h 127.0.0.1" start
//   createdb -h 127.0.0.1 -p 55432 -U postgres defenz_test
//   PGTEST_URL=postgresql://postgres@127.0.0.1:55432/defenz_test npx vitest run sql.integration
//
// NUNCA aponte pro Neon de produção: o teste TRUNCA as tabelas.

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { validarLote, type Tabela } from './schema';
import { sqlDoLote } from './repo';

const URL_TESTE = process.env.PGTEST_URL;

// SQL vai por stdin (e não por -c) porque a interpolação de :'payload' só acontece
// na entrada lida do stdin/arquivo.
function psql(sql: string, payload?: string): string {
  const args = ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', URL_TESTE!];
  if (payload !== undefined) args.push('-v', `payload=${payload}`);
  return execFileSync('psql', args, { input: sql, encoding: 'utf8' }).trim();
}

/** Roda o lote como a aplicação roda: uma transação, o lote inteiro em `$1::jsonb`. */
function gravar(tabela: Tabela, linhas: unknown[]): { inseridos: number; atualizados: number } {
  const { validas, erros } = validarLote(tabela, linhas);
  expect(erros).toEqual([]);
  const payload = JSON.stringify(validas);
  const stmts = sqlDoLote(tabela).map((s) => s.replace(/\$1::jsonb/g, ":'payload'::jsonb"));
  const saida = psql(`begin; ${stmts.join('; ')}; commit;`, payload);
  const flags = saida.split('\n').map((l) => l.trim()).filter((l) => l === 't' || l === 'f');
  return {
    inseridos: flags.filter((f) => f === 't').length,
    atualizados: flags.filter((f) => f === 'f').length,
  };
}

const conta = (tabela: string) => Number(psql(`select count(*) from ${tabela}`));

const aplicarMigration = () =>
  psql(`set client_min_messages = warning;\n\\i db/migrations/0003_dados_negocio.sql`);

const LEAD = {
  lead_id: 'l1',
  nome: 'Fulano',
  empresa: 'Infracommerce',
  owner: 'Gustavo',
  lead_source: 'Apollo',
  lead_status: 'Contatado',
  telefone: '11999998888',
  email: 'f@infra.com',
  created_time: '2026-06-01',
  modified_time: '2026-07-01',
};

const DEAL = {
  id: 'd1',
  nome: 'Defenz <> Infracommerce',
  empresa: 'INFRACOMMERCE',
  stage: 'Fechado Ganho',
  valor: 12500.5,
  lead_source: 'Parceiro SS',
  categoria: 'securisoft',
  comissao_valor: 625.03,
  licencas: 40,
  created_time: '2026-07-01',
  closing_date: '2026-07-20',
  tags: 'Setup Concluido, Na Console',
};

describe.skipIf(!URL_TESTE)('SQL contra Postgres real', () => {
  beforeAll(() => {
    aplicarMigration();
    psql(`truncate deal_tags, deals, classificacoes_ia, agenda_tarefas, leads,
                   ligacoes, emails, resumo_diario, empresas, pessoas restart identity cascade`);
  });

  it('a migration é idempotente (reaplicar não quebra)', () => {
    expect(() => aplicarMigration()).not.toThrow();
  });

  it('deals: grava, resolve a FK de empresa e explode as tags', () => {
    const r = gravar('deals', [DEAL]);
    expect(r).toEqual({ inseridos: 1, atualizados: 0 });
    expect(conta('deals')).toBe(1);
    expect(conta('deal_tags')).toBe(2);
    expect(psql(`select e.nome_exibicao from deals d join empresas e on e.id = d.empresa_id`)).toBe(
      'INFRACOMMERCE'
    );
  });

  it('deals: rodar o MESMO lote de novo atualiza, não duplica', () => {
    const r = gravar('deals', [DEAL]);
    expect(r).toEqual({ inseridos: 0, atualizados: 1 });
    expect(conta('deals')).toBe(1);
    expect(conta('empresas')).toBe(1);
  });

  it('deals: tag removida no Zoho some aqui (substituição completa)', () => {
    gravar('deals', [{ ...DEAL, tags: 'Na Console' }]);
    expect(conta('deal_tags')).toBe(1);
    expect(psql(`select tag from deal_tags`)).toBe('Na Console');
  });

  it('deals: valor e licenças chegam com o tipo certo', () => {
    expect(psql(`select valor, licencas from deals where id = 'd1'`)).toBe('12500.50|40');
  });

  it('ligacoes: fato plano com dimensão de agente', () => {
    const r = gravar('ligacoes', [
      { call_id: 'c1', data: '2026-07-28', hora: '09:15', agente: 'Gustavo', duracao_seg: 42 },
      { call_id: 'c2', data: '2026-07-28', hora: '10:00:30', agente: 'Cris', duracao_seg: 10 },
    ]);
    expect(r).toEqual({ inseridos: 2, atualizados: 0 });
    expect(psql(`select hora from ligacoes where call_id = 'c1'`)).toBe('09:15:00');
    expect(conta('pessoas')).toBe(2);
  });

  it('emails: fato plano', () => {
    expect(gravar('emails', [{ email_id: 'e1', data: '2026-07-28', assunto: 'Oi' }])).toEqual({
      inseridos: 1,
      atualizados: 0,
    });
  });

  it('leads: duas dimensões (empresa + owner) na mesma linha', () => {
    expect(gravar('leads', [LEAD])).toEqual({ inseridos: 1, atualizados: 0 });
    expect(
      psql(`select e.nome_norm, p.nome_norm from leads l
              join empresas e on e.id = l.empresa_id
              join pessoas p on p.id = l.owner_id`)
    ).toBe('INFRACOMMERCE|GUSTAVO');
  });

  it('classificacao_ia: append-only — reclassificar o mesmo lead não sobrescreve', () => {
    gravar('classificacao_ia', [
      { lead_id: 'l1', data_classificacao: '2026-07-28T12:00:00Z', nivel_maximo: 'N2' },
    ]);
    gravar('classificacao_ia', [
      { lead_id: 'l1', data_classificacao: '2026-07-29T12:00:00Z', nivel_maximo: 'N3' },
    ]);
    expect(conta('classificacoes_ia')).toBe(2);
  });

  it('classificacao_ia: mesma (lead, data) atualiza no lugar', () => {
    const r = gravar('classificacao_ia', [
      { lead_id: 'l1', data_classificacao: '2026-07-29T12:00:00Z', nivel_maximo: 'N4' },
    ]);
    expect(r).toEqual({ inseridos: 0, atualizados: 1 });
    expect(conta('classificacoes_ia')).toBe(2);
  });

  it('agenda: tarefa amarrada no lead e no owner', () => {
    expect(
      gravar('agenda', [
        { task_id: 't1', lead_id: 'l1', subject: 'Ligar', due_date: '2026-07-30', owner: 'Gustavo', is_overdue: 'sim' },
      ])
    ).toEqual({ inseridos: 1, atualizados: 0 });
    expect(psql(`select is_overdue from agenda_tarefas where task_id = 't1'`)).toBe('t');
  });

  it('resumo_diario: escalares, jsonb e o null-vs-0 preservado', () => {
    gravar('resumo_diario', [
      {
        data: '2026-07-28',
        atualizado_em: '2026-07-28T20:00:00Z',
        mode: 'live',
        ligacoes_total: 320,
        ligacoes_taxa: 27.5,
        emails_total: '',
        ligacoes_por_vendedor: '{"Gustavo":{"realizadas":200,"atendidas":50}}',
        base_top_contas: '[{"name":"ACME","licencas":900}]',
        destaque_comercial: 'Fechou ACME',
      },
    ]);
    expect(psql(`select ligacoes_total, ligacoes_taxa from resumo_diario`)).toBe('320|27.50');
    // emails_total = '' no Sheets significa NÃO CAPTURADO, e tem que continuar null
    expect(psql(`select emails_total is null from resumo_diario`)).toBe('t');
    expect(psql(`select por_vendedor->'ligacoes'->'Gustavo'->>'realizadas' from resumo_diario`)).toBe('200');
    expect(psql(`select destaques->>'comercial' from resumo_diario`)).toBe('Fechou ACME');
    expect(psql(`select destaques->>'marketing' is null from resumo_diario`)).toBe('t');
  });

  it('resumo_diario: reenviar o mesmo dia atualiza o snapshot', () => {
    const r = gravar('resumo_diario', [{ data: '2026-07-28', ligacoes_total: 999 }]);
    expect(r).toEqual({ inseridos: 0, atualizados: 1 });
    expect(psql(`select ligacoes_total from resumo_diario`)).toBe('999');
  });
});
