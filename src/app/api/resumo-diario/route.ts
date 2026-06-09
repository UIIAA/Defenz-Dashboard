import { NextRequest, NextResponse } from "next/server";
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
  BACKFILL_MAX_DAYS,
} from "@/lib/resumo-diario";
import type { RawResumoDiario, ResumoDiarioResponse } from "@/lib/types";

// NOTE: verifySession protects this APP ROUTE only — it is NOT a confidentiality
// control for the data. The `resumo_diario` tab lives in the public gviz doc
// (1roir...), readable by anyone with the sheet link. The real boundary is the
// sheet's sharing setting (stakeholder accepted "tudo no doc público").

const memoryCache = new Map<string, { data: ResumoDiarioResponse; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayBRT();
  const { searchParams } = new URL(request.url);
  const rawData = searchParams.get("data") || today;
  // Default + clamp into [today-120, today] (BRT). Reject malformed input → today.
  const data = clampData(DATE_RE.test(rawData) ? rawData : today, today);

  const cacheKey = `resumo_${data}`;
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

    if (rowsRaw === null) {
      // Tab not created yet → empty state, NOT a ligacoes-shaped payload.
      const empty: ResumoDiarioResponse = {
        resumo: null,
        datas_disponiveis: [],
        serie: [],
        floor: hardFloor,
        base_atual: null,
      };
      return NextResponse.json(empty);
    }

    const deduped = dedupeByData(rowsRaw);
    const dates = availableDates(rowsRaw);
    const match = deduped.find(r => String(r.data ?? "").slice(0, 10) === data);

    // Base instalada is current-state only (Zoho has no point-in-time history) and is
    // populated only on live days. Expose the most recent base so the Clientes Ativos
    // card always shows the current installed base, even on historical days.
    const baseRows = deduped
      .filter(r => r.base_total_licencas != null && r.base_total_licencas !== "")
      .sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));
    const base_atual = baseRows.length ? parseResumoRow(baseRows[0]).base_instalada : null;

    const response: ResumoDiarioResponse = {
      resumo: match ? parseResumoRow(match) : null,
      datas_disponiveis: dates,
      serie: buildSerie(rowsRaw, data, 30),
      floor: navigatorFloor(dates, today),
      base_atual,
    };

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
