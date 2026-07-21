import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { logAccess } from "@/lib/users";

export async function GET(request: NextRequest) {
  // Auditoria de logout — lê a sessão ANTES de limpar pra saber quem saiu.
  const session = await verifySession(request);
  if (session) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    await logAccess({
      userId: session.sub,
      email: session.email,
      event: "logout",
      ip,
      userAgent: request.headers.get("user-agent") || null,
    }).catch((e) => console.error("logout: falha ao gravar auditoria", e));
  }

  // Use request URL origin to build safe redirect (same-origin only)
  const loginUrl = new URL("/login", request.nextUrl.origin);
  const response = NextResponse.redirect(loginUrl);

  response.cookies.set("defenz_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
