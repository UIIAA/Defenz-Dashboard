// Repositório de usuários + auditoria — feature-auth-individual. Thin sobre src/lib/db.ts.
// SÓ server-side (server actions / route handlers). Não valida papel — quem chama
// (loginAction, ações do /admin) é responsável por checar a sessão antes.

import { db } from "./db";

// Role vinha DUPLICADO aqui e em auth.ts. As duas cópias divergiram na hora de adicionar
// `super_admin` — re-exporta (type-only, some no build) para não haver duas verdades.
export type { Role } from "./auth";
import type { Role } from "./auth";

export type AccessEvent = "login_ok" | "login_fail" | "logout";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface AccessRow {
  id: string;
  email: string;
  event: AccessEvent;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  name: string | null; // do join com users (null se e-mail nunca virou usuário)
}

export async function findActiveUserByEmail(email: string): Promise<UserRow | null> {
  const rows = (await db()`
    select * from users where email = ${email.toLowerCase()} and active = true limit 1
  `) as UserRow[];
  return rows[0] ?? null;
}

export async function recordLogin(userId: string): Promise<void> {
  await db()`update users set last_login_at = now() where id = ${userId}`;
}

export async function logAccess(entry: {
  userId?: string | null;
  email: string;
  event: AccessEvent;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db()`
    insert into access_log (user_id, email, event, ip, user_agent)
    values (${entry.userId ?? null}, ${entry.email.toLowerCase()}, ${entry.event}, ${entry.ip ?? null}, ${entry.userAgent ?? null})
  `;
}

export async function listUsers(): Promise<UserRow[]> {
  return (await db()`select * from users order by created_at asc`) as UserRow[];
}

export async function listRecentAccess(limit = 50): Promise<AccessRow[]> {
  return (await db()`
    select a.id, a.email, a.event, a.ip, a.user_agent, a.created_at, u.name
    from access_log a
    left join users u on u.id = a.user_id
    order by a.created_at desc
    limit ${limit}
  `) as AccessRow[];
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
}): Promise<void> {
  await db()`
    insert into users (email, name, password_hash, role)
    values (${input.email.toLowerCase()}, ${input.name}, ${input.passwordHash}, ${input.role})
  `;
}

/**
 * Papel do alvo de uma ação administrativa. Existe para o /admin poder recusar que um
 * `admin` desative ou troque a senha de um `super_admin` — sem isto, o papel de topo é
 * decorativo (dívida D-01: hoje qualquer admin derruba a conta do dono).
 */
export async function getUserRole(id: string): Promise<Role | null> {
  const rows = (await db()`select role from users where id = ${id} limit 1`) as { role: Role }[];
  return rows[0]?.role ?? null;
}

export async function setActive(id: string, active: boolean): Promise<void> {
  await db()`update users set active = ${active} where id = ${id}`;
}

export async function setPassword(id: string, passwordHash: string): Promise<void> {
  await db()`update users set password_hash = ${passwordHash} where id = ${id}`;
}
