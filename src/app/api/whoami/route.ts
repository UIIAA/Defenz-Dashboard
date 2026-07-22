import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

// feature-metas-canal (Spec 2, Task 5) — expõe o papel da sessão pro front decidir
// se mostra a edição inline (lápis) das metas por canal. Sem dados sensíveis.
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ role: session.role });
}
