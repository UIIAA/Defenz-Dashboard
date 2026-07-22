import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { getChannelTargets, setChannelTargets } from "@/lib/metas-canal";
import type { ChannelTargets } from "@/lib/types";

// feature-metas-canal (Spec 2) — GET (qualquer sessão válida) + PUT (só admin).
// Primeira rota de escrita gated por papel do dashboard: reusa `role` do
// verifySession (feature-auth-individual). Sem cache — são metas de gestão,
// baixo volume de leitura, e a escrita precisa refletir imediatamente.

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getChannelTargets());
}

export async function PUT(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Partial<ChannelTargets>;
  const clean = (n: unknown) => Math.max(0, Number(n) || 0);
  await setChannelTargets(
    { direto: clean(body.direto), parceiro: clean(body.parceiro), securisoft: clean(body.securisoft) },
    session.email
  );
  return NextResponse.json(await getChannelTargets());
}
