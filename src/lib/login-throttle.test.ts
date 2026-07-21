import { describe, it, expect } from "vitest";
import { throttleKey, isBlocked, recordFailure, clearFailures } from "./login-throttle";

describe("login-throttle", () => {
  it("bloqueia após 5 falhas na janela", () => {
    const k = throttleKey("a@b.c", "1.1.1.1");
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(isBlocked(k, t0)).toBe(false);
      recordFailure(k, t0);
    }
    expect(isBlocked(k, t0)).toBe(true);
  });

  it("a janela expira e reseta (> 15 min)", () => {
    const k = throttleKey("b@b.c", "2.2.2.2");
    const t0 = 2_000_000;
    for (let i = 0; i < 5; i++) recordFailure(k, t0);
    expect(isBlocked(k, t0)).toBe(true);
    expect(isBlocked(k, t0 + 16 * 60 * 1000)).toBe(false);
  });

  it("clearFailures zera o contador (após login ok)", () => {
    const k = throttleKey("c@b.c", "3.3.3.3");
    const t0 = 3_000_000;
    for (let i = 0; i < 5; i++) recordFailure(k, t0);
    expect(isBlocked(k, t0)).toBe(true);
    clearFailures(k);
    expect(isBlocked(k, t0)).toBe(false);
  });
});
