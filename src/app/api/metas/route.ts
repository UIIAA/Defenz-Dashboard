import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchTabStrict, fetchFromSheets } from "@/lib/sheets";
import { computeMetas, fonteVenda } from "@/lib/metas";
import { computeFarol, brtParts } from "@/lib/farol";
import type { RawResumoDiario, RawDeal, MetasResponse, FarolRef } from "@/lib/types";

// NOTE: verifySession protects this APP ROUTE only — same confidentiality note as
// /api/resumo-diario: the underlying sheet is a public gviz doc.

const memoryCache = new Map<string, { data: MetasResponse; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const isRange = !!fromRaw && !!toRaw && DATE_RE.test(fromRaw) && DATE_RE.test(toRaw);
  const range = isRange ? { from: fromRaw as string, to: toRaw as string } : undefined;

  const cacheKey = isRange ? `metas_${range!.from}_${range!.to}` : "metas";
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.data,
      _cached: true,
      _cacheAge: Math.round((Date.now() - cached.timestamp) / 1000),
    });
  }

  try {
    const [resumoRowsRaw, deals] = await Promise.all([
      fetchTabStrict("resumo_diario", ["data", "atualizado_em"]) as Promise<
        RawResumoDiario[] | null
      >,
      fetchFromSheets("deals") as Promise<RawDeal[]>,
    ]);

    const now = new Date();
    const { semanas, consolidado, eficiencia } = computeMetas(deals, resumoRowsRaw ?? [], now, 8, range);

    // No /metas a meta conta SÓ Venda direta Defenz — então o Farol também é defenz-only
    // (particionado por fonteVenda), diferente do Farol do /diario, que soma tudo.
    // O Direcionado SS vai num Farol paralelo, informativo.
    const dealsDefenz = deals.filter((d) => fonteVenda(d) === "defenz");
    const dealsDirecionadoSS = deals.filter((d) => fonteVenda(d) === "direcionado-ss");

    // feature-metas-farol-periodo: o Farol RESPEITA o período selecionado.
    // Antes recebia sempre `now`: com "Mês passado" aberto ele mostrava R$ 0 com badge
    // vermelho "fora do ritmo" — ruído, não informação, porque o período já fechou.
    // Agora a referência é `min(hoje, período.to)`: se o intervalo alcança hoje o
    // comportamento é o mesmo de antes (ao vivo); se já fechou, o Farol fala do ÚLTIMO
    // dia do período, e o pace naturalmente vira 100% (semana/mês encerrados).
    const hoje = brtParts(now).date;
    const fim = range && range.to < hoje ? range.to : null;
    const farolRef: FarolRef = fim ? "fim-do-periodo" : "ao-vivo";
    // 23:59:59 BRT do último dia = 02:59:59Z do dia seguinte.
    const ref = fim ? new Date(`${fim}T23:59:59-03:00`) : now;
    const farol = computeFarol(dealsDefenz, ref);
    const farolDirecionadoSS = computeFarol(dealsDirecionadoSS, ref);

    const response: MetasResponse = {
      semanas,
      consolidado,
      periodo: isRange ? { from: range!.from, to: range!.to, nWeeks: consolidado.nWeeks } : null,
      farol,
      farolDirecionadoSS,
      farolRef,
      eficiencia,
      generatedAt: now.toISOString(),
    };

    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in metas route:", error);
    return NextResponse.json(
      { error: "Erro ao buscar métricas de metas" },
      { status: 500 }
    );
  }
}
