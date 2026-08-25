import { NextRequest } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "defenz_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// feature-super-admin. `super_admin` é SUPERSET de `admin`: tudo que admin faz, ele faz.
// A única coisa que só ele faz é mexer noutro super_admin (ver src/app/admin/actions.ts).
export type Role = "super_admin" | "admin" | "member";

export const ROLES: readonly Role[] = ["super_admin", "admin", "member"] as const;

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/**
 * Tem poderes administrativos. USE ISTO — nunca `role === "admin"`.
 *
 * Comparar com a string crua foi o que quase trancou o dono pra fora: promover alguém a
 * super_admin com um `role === "admin"` sobrando no caminho remove o poder em vez de somar.
 */
export function isAdmin(role: Role | undefined | null): boolean {
  return role === "admin" || role === "super_admin";
}

/** Só o topo: gerir outros super_admins e ver telas ainda não liberadas. */
export function isSuperAdmin(role: Role | undefined | null): boolean {
  return role === "super_admin";
}

// feature-auth-individual: a sessão passou a carregar a IDENTIDADE (antes era só
// `{ authenticated }`). Cookies antigos sem `sub` são rejeitados no verify → forçam
// re-login uma vez. O middleware lê role/sub daqui SEM tocar o banco.
export interface SessionPayload {
  sub: string; // users.id
  email: string;
  name: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
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

// Exportada (antes era privada `verify`) para ser testável direto por token.
export async function verifyToken(token: string): Promise<SessionPayload | null> {
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
    // Exige identidade: cookies antigos (sem sub) e papéis inválidos são rejeitados.
    if (!parsed.sub || !isRole(parsed.role)) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
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
  return verifyToken(token);
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
