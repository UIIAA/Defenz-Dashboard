// Hashing de senha — feature-auth-individual §7. scrypt do node:crypto (sem dependência).
// Roda em Node (server action de login), nunca no middleware. Formato serializado:
//   scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
// PS: mantido em sincronia com scripts/users.mjs (bootstrap CLI) — mesmos parâmetros.

import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const N = 16384; // custo CPU/memória (2^14). 128*N*r ≈ 16MB < 32MB (maxmem padrão do scrypt)
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (
    !Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) ||
    salt.length === 0 || expected.length === 0
  ) {
    return false;
  }
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length, { N: n, r, p });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// Hash "queima-CPU" para o caminho e-mail-inexistente: verificamos contra ele para
// que o tempo de resposta não revele se o e-mail existe (anti-enumeração/timing).
export const DUMMY_HASH = hashPassword("defenz-dummy-password-anti-enumeration");
