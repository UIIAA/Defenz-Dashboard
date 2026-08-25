import { NextRequest, NextResponse } from "next/server";
import { verifySession, isAdmin } from "@/lib/auth";
import { getChannelTargets, setChannelTargets } from "@/lib/metas-canal";
import type { CanalCategoria, ChannelTargets } from "@/lib/types";

// feature-metas-canal (Spec 2) — GET (qualquer sessão válida) + PUT (só admin).
// Primeira rota de escrita gated por papel do dashboard: reusa `role` do
// verifySession (feature-auth-individual). Sem cache — são metas de gestão,
// baixo volume de leitura, e a escrita precisa refletir imediatamente.

const CATEGORIAS: CanalCategoria[] = ["direto", "parceiro", "securisoft"];

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getChannelTargets());
}

export async function PUT(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Partial<Record<CanalCategoria, unknown>> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad Request: corpo ausente ou inválido" }, { status: 400 });
  }

  // Hardening (review Spec 2): um payload parcial (canal ausente ou não-numérico)
  // NUNCA é coagido a 0 — isso zeraria silenciosamente a meta de um canal. Exige
  // os 3 valores numéricos >= 0 no corpo, senão 400. O editor inline sempre manda
  // os 3 (seed do estado atual), então isso só barra chamadas malformadas.
  const clean: Partial<ChannelTargets> = {};
  for (const categoria of CATEGORIAS) {
    const value = body[categoria];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return NextResponse.json(
        { error: `Bad Request: '${categoria}' ausente ou não-numérico (>= 0 obrigatório)` },
        { status: 400 }
      );
    }
    clean[categoria] = value;
  }

  await setChannelTargets(clean as ChannelTargets, session.email);
  return NextResponse.json(await getChannelTargets());
}
