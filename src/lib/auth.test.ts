import { describe, it, expect, beforeAll } from "vitest";
import { createSession, verifyToken } from "./auth";
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
