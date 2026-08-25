import { describe, it, expect, beforeAll } from "vitest";
import { createSession, verifyToken, isAdmin, isSuperAdmin, isRole, ROLES } from "./auth";
import { createHmac } from "node:crypto";

const SECRET = "test-secret-0123456789abcdefghijklmnopqrstuv"; // >= 32 chars
beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});

const USER = { id: "u-123", email: "marcos@defenz.com.br", name: "Marcos", role: "admin" as const };
const nowSec = () => Math.floor(Date.now() / 1000);

function craft(payloadObj: Record<string, unknown>, secret = SECRET): string {
  const payload = JSON.stringify(payloadObj);
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

describe("auth — sessão com identidade", () => {
  it("createSession → verifyToken devolve sub/email/role", async () => {
    const token = await createSession(USER);
    expect(token).toBeTruthy();
    const p = await verifyToken(token!);
    expect(p?.sub).toBe("u-123");
    expect(p?.email).toBe("marcos@defenz.com.br");
    expect(p?.role).toBe("admin");
  });

  it("token expirado → null", async () => {
    const token = craft({ sub: "u1", email: "a@b.c", name: "A", role: "member", iat: nowSec() - 100, exp: nowSec() - 10 });
    expect(await verifyToken(token)).toBeNull();
  });

  it("assinatura adulterada → null", async () => {
    const token = await createSession(USER);
    const bad = token!.slice(0, -1) + (token!.slice(-1) === "a" ? "b" : "a");
    expect(await verifyToken(bad)).toBeNull();
  });

  it("cookie antigo sem sub → null (força re-login)", async () => {
    const token = craft({ authenticated: true, iat: nowSec(), exp: nowSec() + 1000 });
    expect(await verifyToken(token)).toBeNull();
  });

  it("role inválido → null", async () => {
    const token = craft({ sub: "u1", email: "a@b.c", name: "A", role: "superadmin", iat: nowSec(), exp: nowSec() + 1000 });
    expect(await verifyToken(token)).toBeNull();
  });

  it("assinado com outro segredo → null", async () => {
    const token = craft(
      { sub: "u1", email: "a@b.c", name: "A", role: "admin", iat: nowSec(), exp: nowSec() + 1000 },
      "segredo-completamente-diferente-aaaaaaaaaaaa"
    );
    expect(await verifyToken(token)).toBeNull();
  });
});

// ── feature-super-admin ───────────────────────────────────────────────────────
// Regressão aqui TRANCA GENTE PRA FORA: `isAdmin` errado tira o poder de quem foi
// promovido, e `isRole` errado faz o verify recusar a sessão inteira (loop de login).
describe("papéis — super_admin é superset de admin", () => {
  it("isAdmin aceita admin E super_admin, recusa member", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("super_admin")).toBe(true);
    expect(isAdmin("member")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("isSuperAdmin só o topo — admin NÃO passa", () => {
    expect(isSuperAdmin("super_admin")).toBe(true);
    expect(isSuperAdmin("admin")).toBe(false);
    expect(isSuperAdmin("member")).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });

  it("isRole reconhece os três e recusa lixo", () => {
    expect(ROLES).toEqual(["super_admin", "admin", "member"]);
    for (const r of ROLES) expect(isRole(r)).toBe(true);
    for (const lixo of ["owner", "Admin", "", null, undefined, 1, {}]) {
      expect(isRole(lixo)).toBe(false);
    }
  });

  it("verifyToken ACEITA sessão de super_admin (senão o dono não loga)", async () => {
    const token = await createSession({ ...USER, role: "super_admin" });
    const out = await verifyToken(token!);
    expect(out?.role).toBe("super_admin");
  });

  it("verifyToken recusa papel desconhecido", async () => {
    const token = craft({ sub: "u-1", email: "x@y.z", name: "X", role: "owner", iat: nowSec(), exp: nowSec() + 60 });
    expect(await verifyToken(token)).toBeNull();
  });
});
