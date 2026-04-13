import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";
import { correlateLeads } from "@/lib/correlate";
import { buildExecutiveExcel, computeKPIs } from "@/lib/excel-builder";
import { computeMetrics } from "@/lib/metrics";
import type { RawDeal, RawCall, RawEmail, RawClassificacao } from "@/lib/types";

// Rate limit: 1 request per 30s per IP
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const lastReq = rateLimitMap.get(ip) || 0;
  if (Date.now() - lastReq < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Wait 30 seconds." },
      { status: 429 }
    );
  }
  rateLimitMap.set(ip, Date.now());

  // Cleanup old entries
  if (rateLimitMap.size > 100) {
    const now = Date.now();
    for (const [key, ts] of rateLimitMap) {
      if (now - ts > RATE_LIMIT_MS * 2) rateLimitMap.delete(key);
    }
  }

  try {
    // Fetch all tabs in parallel (new sheet structure)
    const [leads, calls, emails, classificacoes, deals] = await Promise.all([
      fetchFromSheets("leads"),
      fetchFromSheets("ligacoes") as Promise<RawCall[]>,
      fetchFromSheets("emails") as Promise<RawEmail[]>,
      fetchFromSheets("classificacao_ia") as Promise<RawClassificacao[]>,
      fetchFromSheets("deals") as Promise<RawDeal[]>,
    ]);

    // Compute 30d metrics from raw data
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const metrica30d = computeMetrics(deals, calls, emails, classificacoes, {
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    });

    // Correlate leads with calls and emails
    const enrichedLeads = correlateLeads(leads, calls, emails, classificacoes);

    // Compute KPIs
    const kpis = computeKPIs(enrichedLeads, metrica30d);

    // Build Excel
    const buffer = await buildExecutiveExcel(enrichedLeads, metrica30d, kpis);

    const todayStr = today.toISOString().split("T")[0];
    const filename = `defenz_executivo_${todayStr}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating Excel:", error);
    return NextResponse.json(
      { error: "Erro ao gerar Excel executivo" },
      { status: 500 }
    );
  }
}
