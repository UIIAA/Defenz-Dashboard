// feature-auth-individual — CLI de bootstrap/admin de usuários (Fase 1).
// Carrega .env.local sozinho (Node >= 20.12). Uso:
//   node scripts/users.mjs migrate                                  # aplica db/migrations/0001_auth.sql
//   node scripts/users.mjs add <email> "<nome>" <senha> [admin|member]
//   node scripts/users.mjs list
//   node scripts/users.mjs reset <email> <novaSenha>
//   node scripts/users.mjs disable <email>
//   node scripts/users.mjs enable <email>
//
// O hash é gravado no formato scrypt$N$r$p$salt$hash — verifyPassword (src/lib/password.ts)
// lê N/r/p do próprio hash, então não há acoplamento de parâmetros entre este script e o app.

import { scryptSync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* env pode já estar no ambiente */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida (.env.local).");
  process.exit(1);
}
const sql = neon(url);

function hashPassword(pw) {
  const N = 16384, r = 8, p = 1, keylen = 64;
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, keylen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function applyMigration(filename) {
  const ddl = readFileSync(new URL(`../db/migrations/${filename}`, import.meta.url), "utf8");
  const stmts = ddl
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of stmts) await sql.query(s);
  return stmts.length;
}

async function migrate() {
  const n1 = await applyMigration("0001_auth.sql");
  const n2 = await applyMigration("0002_channel_targets.sql");
  console.log(`migrate ok (${n1 + n2} statements aplicados).`);
}

async function add([email, name, password, role = "member"]) {
  if (!email || !name || !password) throw new Error('uso: add <email> "<nome>" <senha> [admin|member]');
  const r = role === "admin" ? "admin" : "member";
  await sql`insert into users (email, name, password_hash, role)
            values (${email.toLowerCase()}, ${name}, ${hashPassword(password)}, ${r})`;
  console.log(`ok: ${email} (${r}) criado.`);
}

async function list() {
  const rows = await sql`select email, name, role, active, last_login_at
                         from users order by created_at asc`;
  if (!rows.length) return console.log("(nenhum usuário)");
  for (const u of rows) {
    console.log(
      `${u.active ? "●" : "○"} ${u.email.padEnd(30)} ${u.role.padEnd(7)} ${u.name.padEnd(20)} último: ${u.last_login_at ?? "—"}`
    );
  }
}

async function reset([email, password]) {
  if (!email || !password) throw new Error("uso: reset <email> <novaSenha>");
  const rows = await sql`update users set password_hash = ${hashPassword(password)}
                         where email = ${email.toLowerCase()} returning id`;
  console.log(rows.length ? `ok: senha de ${email} redefinida.` : `nada: ${email} não encontrado.`);
}

async function toggle([email], active) {
  if (!email) throw new Error(`uso: ${active ? "enable" : "disable"} <email>`);
  const rows = await sql`update users set active = ${active}
                         where email = ${email.toLowerCase()} returning id`;
  console.log(rows.length ? `ok: ${email} ${active ? "reativado" : "desativado"}.` : `nada: ${email} não encontrado.`);
}

const [cmd, ...args] = process.argv.slice(2);
const run = {
  migrate: () => migrate(),
  add: () => add(args),
  list: () => list(),
  reset: () => reset(args),
  disable: () => toggle(args, false),
  enable: () => toggle(args, true),
};

if (!run[cmd]) {
  console.error("comandos: migrate | add | list | reset | disable | enable");
  process.exit(1);
}

run[cmd]()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("erro:", e.message || e);
    process.exit(1);
  });
