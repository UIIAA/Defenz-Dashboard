import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, DUMMY_HASH } from "./password";

describe("password — scrypt hash/verify", () => {
  it("verifica a senha correta", () => {
    const h = hashPassword("s3nh4-boa");
    expect(verifyPassword("s3nh4-boa", h)).toBe(true);
  });

  it("rejeita senha errada", () => {
    const h = hashPassword("s3nh4-boa");
    expect(verifyPassword("errada", h)).toBe(false);
  });

  it("gera hashes diferentes pra mesma senha (salt aleatório)", () => {
    expect(hashPassword("igual")).not.toBe(hashPassword("igual"));
  });

  it("formato scrypt$N$r$p$salt$hash", () => {
    const parts = hashPassword("x").split("$");
    expect(parts[0]).toBe("scrypt");
    expect(parts).toHaveLength(6);
  });

  it("string malformada → false (não lança)", () => {
    expect(verifyPassword("x", "lixo")).toBe(false);
    expect(verifyPassword("x", "scrypt$16384$8$1$zz")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });

  it("hash adulterado → false", () => {
    const h = hashPassword("abc");
    const tampered = h.slice(0, -1) + (h.slice(-1) === "a" ? "b" : "a");
    expect(verifyPassword("abc", tampered)).toBe(false);
  });

  it("DUMMY_HASH é scrypt válido e não bate com senha comum", () => {
    expect(DUMMY_HASH.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("admin", DUMMY_HASH)).toBe(false);
  });
});
