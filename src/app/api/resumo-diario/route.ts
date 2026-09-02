import { NextRequest, NextResponse } from "next/server";
import { CACHE_TTL_MS } from "@/lib/cache-ttl";
import { verifySession } from "@/lib/auth";
import { fetchTabStrict } from "@/lib/sheets";
import {
  todayBRT,
  clampData,
  addDays,
  parseResumoRow,
  dedupeByData,
  availableDates,
  buildSerie,
  navigatorFloor,
  aggregateRange,
  daysInRange,
  spanDays,
  BACKFILL_MAX_DAYS,
  resolveDataPedida,
  ULTIMO,
} from "@/lib/resumo-diario";
import type { RawResumoDiario, ResumoDiarioResponse } from "@/lib/types";

// NOTE: verifySession protects this APP ROUTE only — it is NOT a confidentiality
// control for the data. The `resumo_diario` tab lives in the public gviz doc
// (1roir...), readable by anyone with the sheet link. The real boundary is the
// sheet's sharing setting (stakeholder accepted "tudo no doc público").

const memoryCache = new Map<string, { data: ResumoDiarioResponse; timestamp: number }>();


const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayBRT();
  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const isRange = !!fromRaw && !!toRaw && DATE_RE.test(fromRaw) && DATE_RE.test(toRaw);

  const rawData = searchParams.get("data") || today;
  // feature-040 pedido 1 — `data=ultimo` pede o dia mais recente COM LINHA. Só dá para
  // resolver depois de ler a aba, então aqui só marcamos a intenção.
  const querUltimo = rawData === ULTIMO;
  // Default + clamp into [today-120, today] (BRT). Reject malformed input → today.
  const data = clampData(DATE_RE.test(rawData) ? rawData : today, today);

  // Range mode: clamp both ends into [today-120, today], ensure from <= to.
  let from = isRange ? clampData(fromRaw as string, today) : data;
  let to = isRange ? clampData(toRaw as string, today) : data;
  if (isRange && from > to) { const t = from; from = to; to = t; }

  const cacheKey = isRange
    ? `range_${from}_${to}`
    : querUltimo
      ? `resumo_${ULTIMO}`
      : `resumo_${data}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.data,
      _cached: true,
      _cacheAge: Math.round((Date.now() - cached.timestamp) / 1000),
    });
  }

  try {
    // Strict fetch: returns null if the tab doesn't exist yet (gviz would otherwise
    // hand back sheet 0 = ligacoes). 'data' + 'atualizado_em' is the tab signature.
    const rowsRaw = (await fetchTabStrict("resumo_diario", [
      "data",
      "atualizado_em",
    ])) as RawResumoDiario[] | null;

    const hardFloor = addDays(today, -BACKFILL_MAX_DAYS);

    // O Farol de Metas saiu do /diario (feature-metas-robo-semana §1) — agora vive
    // só no /metas (defenz-only). Aqui não computamos mais nada de farol.

    if (rowsRaw === null) {
      // Tab not created yet → empty state, NOT a ligacoes-shaped payload.
      const empty: ResumoDiarioResponse = {
        resumo: null,
        datas_disponiveis: [],
        serie: [],
        floor: hardFloor,
        base_atual: null,
        periodo: null,
        data_resolvida: data,
      };
      return NextResponse.json(empty);
    }

    const deduped = dedupeByData(rowsRaw);
    const dates = availableDates(rowsRaw);
    // Só agora dá para saber qual é o último dia com linha.
    const dataEfetiva = querUltimo
      ? clampData(resolveDataPedida(ULTIMO, dates, today), today)
      : data;
    const match = deduped.find(r => String(r.data ?? "").slice(0, 10) === dataEfetiva);

    // Base instalada is current-state only (Zoho has no point-in-time history) and is
    // populated only on live days. Expose the most recent base so the Clientes Ativos
    // card always shows the current installed base, even on historical days.
    const baseRows = deduped
      .filter(r => r.base_total_licencas != null && r.base_total_licencas !== "")
      .sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));
    const base_atual = baseRows.length ? parseResumoRow(baseRows[0]).base_instalada : null;

    let response: ResumoDiarioResponse;
    if (isRange) {
      const agg = aggregateRange(rowsRaw, from, to, base_atual);
      response = {
        resumo: agg,
        datas_disponiveis: dates,
        serie: buildSerie(rowsRaw, to, Math.max(7, Math.min(120, spanDays(from, to)))),
        floor: navigatorFloor(dates, today),
        base_atual,
        periodo: agg ? { from, to, dias: daysInRange(dates, from, to) } : null,
      };
    } else {
      response = {
        resumo: match ? parseResumoRow(match) : null,
        datas_disponiveis: dates,
        serie: buildSerie(rowsRaw, dataEfetiva, 30),
        floor: navigatorFloor(dates, today),
        base_atual,
        periodo: null,
        data_resolvida: dataEfetiva,
      };
    }

    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in resumo-diario route:", error);
    return NextResponse.json(
      { error: "Erro ao buscar resumo diário" },
      { status: 500 }
    );
  }
}
