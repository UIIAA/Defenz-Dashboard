import { NextRequest, NextResponse } from "next/server";
import { verifySession, isAdmin } from "@/lib/auth";

// `/api/ingest` (e `/api/ingest/paridade`) NÃO passam pelo guard de sessão porque são
// máquina-a-máquina: quem chama é o n8n, que não tem cookie. A autenticação delas é o
// header X-Ingest-Token, comparado em tempo constante dentro da própria rota
// (feature-migracao-neon §Segurança). Sem token válido, a rota devolve 401 sozinha.
const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico", "/api/ingest"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Verify session (só a assinatura do cookie — sem tocar o banco)
  const session = await verifySession(request);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Gate de papel: /admin é só pra admin (role lido do cookie, sem query).
  if (pathname.startsWith("/admin") && !isAdmin(session.role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
