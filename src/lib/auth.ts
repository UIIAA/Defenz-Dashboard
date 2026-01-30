import { NextRequest } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "defenz_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

interface SessionPayload {
  authenticated: boolean;
  iat: number;
  exp: number;
}

function getSecret(): ArrayBuffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret).buffer as ArrayBuffer;
}

async function sign(payload: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${payload}.${sigHex}`;
}

async function verify(token: string): Promise<SessionPayload | null> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;

  const payload = token.slice(0, lastDot);
  const providedSig = token.slice(lastDot + 1);

  // Validate hex signature length (SHA-256 = 64 hex chars)
  if (providedSig.length !== 64) return null;

  const secret = getSecret();
  if (!secret) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      secret,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = new Uint8Array(
      providedSig.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payload)
    );

    if (!valid) return null;

    const parsed: SessionPayload = JSON.parse(payload);
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createSession(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    authenticated: true,
    iat: now,
    exp: now + SESSION_MAX_AGE,
  };
  return sign(JSON.stringify(payload));
}

export async function verifySession(
  request?: NextRequest
): Promise<SessionPayload | null> {
  let token: string | undefined;

  if (request) {
    token = request.cookies.get(COOKIE_NAME)?.value;
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value;
  }

  if (!token) return null;
  return verify(token);
}

export function getSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = new TextEncoder().encode(a);
  const bBuf = new TextEncoder().encode(b);
  let result = 0;
  for (let i = 0; i < aBuf.length; i++) {
    result |= aBuf[i] ^ bBuf[i];
  }
  return result === 0;
}
