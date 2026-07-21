import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchTabStrict, fetchFromSheets } from "@/lib/sheets";
import { computeMetas, fonteVenda } from "@/lib/metas";
import { computeFarol } from "@/lib/farol";
import type { RawResumoDiario, RawDeal, MetasResponse } from "@/lib/types";

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
    const { semanas, consolidado } = computeMetas(deals, resumoRowsRaw ?? [], now, 8, range);

    // Farol ao vivo (semana/mês). No /metas a meta conta SÓ Venda Defenz — então o
    // Farol também é defenz-only (particionado por fonteVenda), diferente do antigo
    // Farol do /diario que somava tudo. O Repasse SS vai num Farol paralelo, informativo.
    const dealsDefenz = deals.filter((d) => fonteVenda(d) === "defenz");
    const dealsRepasse = deals.filter((d) => fonteVenda(d) === "repasse");
    const farol = computeFarol(dealsDefenz, now);
    const farolRepasse = computeFarol(dealsRepasse, now);

    const response: MetasResponse = {
      semanas,
      consolidado,
      periodo: isRange ? { from: range!.from, to: range!.to, nWeeks: consolidado.nWeeks } : null,
      farol,
      farolRepasse,
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
