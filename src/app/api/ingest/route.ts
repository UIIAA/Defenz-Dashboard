// feature-migracao-neon (Fase 1) — rota de ingestão máquina-a-máquina.
//
// O n8n NÃO fala com o Postgres direto (spec §Decisões 2): ele faz POST aqui e o
// código valida e grava. O mapeamento de colunas na UI do n8n já falhou em silêncio
// duas vezes; aqui, campo torto vira erro reportado na resposta.
//
// NÃO usa sessão de usuário — autentica pelo header X-Ingest-Token. Por isso está
// na allowlist do src/middleware.ts.

import { NextRequest, NextResponse } from 'next/server';
import { isTabela, validarLote, type ErroLinha } from '@/lib/ingest/schema';
import { gravarLote } from '@/lib/ingest/repo';
import { tokenValido, MAX_LINHAS, MAX_BYTES } from '@/lib/ingest/token';

// Rate limit próprio: o n8n manda até 24 lotes seguidos (11,5k ligações / 500),
// então o teto é bem mais alto que o das rotas de leitura.
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 120;
const RATE_WINDOW = 60_000;

function isRateLimited(chave: string): boolean {
  const agora = Date.now();
  const recentes = (rateMap.get(chave) ?? []).filter((t) => agora - t < RATE_WINDOW);
  if (recentes.length >= RATE_LIMIT) return true;
  recentes.push(agora);
  rateMap.set(chave, recentes);
  return false;
}

export async function POST(request: NextRequest) {
  if (!tokenValido(request.headers.get('x-ingest-token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const tamanho = Number(request.headers.get('content-length') ?? 0);
  if (tamanho > MAX_BYTES) {
    return NextResponse.json({ error: 'Payload muito grande' }, { status: 413 });
  }

  let body: { tabela?: unknown; execucao?: unknown; linhas?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { tabela, linhas } = body;
  if (!isTabela(tabela)) {
    return NextResponse.json({ error: 'tabela desconhecida' }, { status: 400 });
  }
  if (!Array.isArray(linhas)) {
    return NextResponse.json({ error: 'linhas deve ser um array' }, { status: 400 });
  }
  if (linhas.length > MAX_LINHAS) {
    return NextResponse.json(
      { error: `máximo de ${MAX_LINHAS} linhas por requisição` },
      { status: 413 }
    );
  }

  const execucao = typeof body.execucao === 'string' ? body.execucao.slice(0, 120) : '—';
  const { validas, erros, duplicados } = validarLote(tabela, linhas);

  try {
    const { inseridos, atualizados, orfaos, erros: errosFk } = await gravarLote(tabela, validas);
    const todos: ErroLinha[] = [...erros, ...errosFk];

    const resposta = {
      recebidos: linhas.length,
      inseridos,
      atualizados,
      rejeitados: todos.length,
      duplicados,
      // linhas gravadas sem o lead referenciado (agenda) — reportado, nunca silencioso
      orfaos,
      erros: todos.slice(0, 50),
    };

    console.log(
      `[ingest] tabela=${tabela} execucao=${execucao} recebidos=${resposta.recebidos} ` +
        `inseridos=${inseridos} atualizados=${atualizados} rejeitados=${resposta.rejeitados} ` +
        `duplicados=${duplicados} orfaos=${orfaos}`
    );

    return NextResponse.json(resposta);
  } catch (e: unknown) {
    // Falha de Neon NÃO pode virar incidente nesta fase — o Sheets é a fonte da
    // verdade e o nó do n8n usa onError: continueRegularOutput. Devolvemos 500 com
    // a causa pra aparecer no log do n8n, e a execução dele segue.
    const causa = e instanceof Error ? e.message : String(e);
    console.error(`[ingest] falha tabela=${tabela} execucao=${execucao}:`, causa);
    return NextResponse.json(
      { error: 'Falha ao gravar no Neon', detalhe: causa.slice(0, 300) },
      { status: 500 }
    );
  }
}
