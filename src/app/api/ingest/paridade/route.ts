// feature-migracao-neon (Fase 1) — O PORTÃO.
//
// GET /api/ingest/paridade            → todas as 7 tabelas
// GET /api/ingest/paridade?tabela=deals
//
// A fase 1 só fecha quando isto vier verde por 7 dias corridos (spec §Validação).
// REGRA: divergência não se resolve mexendo no comparador — se investiga.
//
// Autentica por X-Ingest-Token (n8n/cron) OU por sessão de usuário (Marcos abrindo
// no navegador). A rota está fora do middleware por herdar o prefixo /api/ingest.

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { fetchTabStrict } from '@/lib/sheets';
import { TABELAS, isTabela, type Tabela } from '@/lib/ingest/schema';
import { resumirNeon, datasDoResumo } from '@/lib/ingest/repo';
import {
  resumirSheets,
  compararResumos,
  paresUnificados,
  diasUteisFaltando,
  avaliarDiasUteis,
  type Veredito,
} from '@/lib/ingest/paridade';

const ATESTADO = 'docs/ATESTADO_PARIDADE_NEON_2026-07-28.md';
import { tokenValido } from '@/lib/ingest/token';

// Leitura ESTRITA com coluna-assinatura (regra derivada do bug de 28/07: gviz devolve
// a sheet-0 em silêncio quando a aba pedida não existe — foi assim que 11,5k ligações
// viraram reunião). Sem assinatura, um erro de nome de aba viraria "paridade verde".
const ABAS: Record<Tabela, { aba: string; assinatura: string[] }> = {
  deals: { aba: 'deals', assinatura: ['id', 'stage'] },
  ligacoes: { aba: 'ligacoes', assinatura: ['call_id', 'data'] },
  emails: { aba: 'emails', assinatura: ['email_id', 'data'] },
  leads: { aba: 'leads', assinatura: ['lead_id'] },
  classificacao_ia: { aba: 'classificacao_ia', assinatura: ['lead_id', 'data_classificacao'] },
  agenda: { aba: 'agenda', assinatura: ['task_id'] },
  resumo_diario: { aba: 'resumo_diario', assinatura: ['data', 'atualizado_em'] },
};

interface Diagnostico extends Veredito {
  /** variantes de nome de empresa que colapsam numa só (spec §Riscos 1) */
  empresas_unificadas?: { nome_norm: string; variantes: string[] }[];
  /** dias Seg–Sex sem snapshot */
  dias_uteis_faltando?: string[];
  motivo?: string;
}

async function avaliar(tabela: Tabela): Promise<Diagnostico> {
  const { aba, assinatura } = ABAS[tabela];
  const linhas = await fetchTabStrict(aba, assinatura);

  if (linhas === null) {
    return {
      tabela,
      veredito: 'vermelho',
      checagens: [],
      motivo: `aba '${aba}' ausente ou sem as colunas ${assinatura.join('/')} — NÃO ajuste o comparador, investigue a planilha`,
    };
  }

  const sheets = resumirSheets(tabela, linhas);
  const neon = await resumirNeon(tabela);
  const base = compararResumos(tabela, neon, sheets);
  const out: Diagnostico = { ...base };

  if (tabela === 'deals' || tabela === 'leads') {
    const pares = paresUnificados(linhas, 'empresa');
    if (pares.length) out.empresas_unificadas = pares;
  }

  if (tabela === 'resumo_diario') {
    const de = String(sheets.data_min ?? '');
    const ate = String(sheets.data_max ?? '');
    if (de && ate) {
      const faltando = diasUteisFaltando(await datasDoResumo(), de, ate);
      const { ok, novos } = avaliarDiasUteis(faltando);
      out.dias_uteis_faltando = faltando;

      out.checagens = [
        ...out.checagens,
        {
          nome: 'dias_uteis_completos',
          neon: faltando.length,
          sheets: 0,
          ok,
          status: ok ? (faltando.length ? 'baseline' : 'ok') : 'divergente',
          delta: faltando.length,
          nota: ok
            ? faltando.length
              ? `buracos de coleta já apurados (${faltando.join(', ')}) — ver ${ATESTADO}`
              : undefined
            : `dia útil NOVO sem snapshot: ${novos.join(', ')} — o Snapshot Diário falhou`,
        },
      ];
      if (!ok) out.veredito = 'vermelho';
    }
  }

  return out;
}

export async function GET(request: NextRequest) {
  const autorizado =
    tokenValido(request.headers.get('x-ingest-token')) || (await verifySession(request)) !== null;
  if (!autorizado) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pedida = request.nextUrl.searchParams.get('tabela');
  if (pedida !== null && !isTabela(pedida)) {
    return NextResponse.json({ error: 'tabela desconhecida' }, { status: 400 });
  }
  const alvo: readonly Tabela[] = pedida ? [pedida] : TABELAS;

  try {
    const tabelas: Diagnostico[] = [];
    for (const t of alvo) tabelas.push(await avaliar(t));

    // `ressalvas` nunca fica invisível: verde COM divergência conhecida tem que
    // aparecer, senão o baseline vira tapete pra esconder sujeira embaixo.
    const ressalvas = tabelas.flatMap((t) =>
      t.checagens.filter((c) => c.status === 'baseline').map((c) => `${t.tabela}.${c.nome}`)
    );
    const obsoletos = tabelas.flatMap((t) =>
      t.checagens.filter((c) => c.status === 'obsoleto').map((c) => `${t.tabela}.${c.nome}`)
    );

    return NextResponse.json({
      verificado_em: new Date().toISOString(),
      veredito: tabelas.every((t) => t.veredito === 'verde') ? 'verde' : 'vermelho',
      ressalvas,
      ...(obsoletos.length
        ? { baseline_obsoleto: obsoletos, acao: `origem corrigida — remova a entrada em ${ATESTADO}` }
        : {}),
      tabelas,
    });
  } catch (e: unknown) {
    const causa = e instanceof Error ? e.message : String(e);
    console.error('[paridade] falha:', causa);
    return NextResponse.json(
      { error: 'Falha ao comparar', detalhe: causa.slice(0, 300) },
      { status: 500 }
    );
  }
}
