import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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
