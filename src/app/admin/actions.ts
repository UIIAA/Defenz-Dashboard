"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, isAdmin, isSuperAdmin, isRole, type Role } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { createUser, setActive, setPassword, getUserRole } from "@/lib/users";

// Defesa em profundidade: o middleware já barra /admin pra não-admin, mas server
// actions podem ser chamadas direto — então re-checamos o papel aqui.
async function requireAdmin() {
  const session = await verifySession();
  if (!session || !isAdmin(session.role)) redirect("/");
  return session;
}

/**
 * Um `admin` não mexe em `super_admin` — só outro super_admin mexe.
 * Sem esta regra o papel de topo é decorativo: qualquer admin desativaria a conta do dono
 * ou trocaria a senha dela (dívida D-01).
 */
async function podeMexerEm(alvoId: string, atorRole: Role): Promise<boolean> {
  if (isSuperAdmin(atorRole)) return true;
  const alvo = await getUserRole(alvoId);
  return !isSuperAdmin(alvo);
}

export async function createUserAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // ANTES isto era `=== "admin" ? "admin" : "member"`: qualquer papel desconhecido virava
  // `member` EM SILÊNCIO — o que rebaixaria um super_admin ao salvar o formulário.
  // Agora só papel válido passa, e conceder `super_admin` exige ser super_admin.
  const bruto = String(formData.get("role") ?? "member");
  let role: Role = isRole(bruto) ? bruto : "member";
  if (role === "super_admin" && !isSuperAdmin(session.role)) role = "admin";

  if (!email || !name || password.length < 6) return;
  try {
    await createUser({ email, name, passwordHash: hashPassword(password), role });
  } catch (e) {
    console.error("admin: createUser (e-mail duplicado?)", e);
  }
  revalidatePath("/admin");
}

export async function toggleActiveAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (id && (await podeMexerEm(id, session.role))) await setActive(id, active);
  revalidatePath("/admin");
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (id && password.length >= 6 && (await podeMexerEm(id, session.role))) {
    await setPassword(id, hashPassword(password));
  }
  revalidatePath("/admin");
}
