"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, type Role } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { createUser, setActive, setPassword } from "@/lib/users";

// Defesa em profundidade: o middleware já barra /admin pra não-admin, mas server
// actions podem ser chamadas direto — então re-checamos o papel aqui.
async function requireAdmin() {
  const session = await verifySession();
  if (!session || session.role !== "admin") redirect("/");
  return session;
}

export async function createUserAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role: Role = String(formData.get("role") ?? "member") === "admin" ? "admin" : "member";

  if (!email || !name || password.length < 6) return;
  try {
    await createUser({ email, name, passwordHash: hashPassword(password), role });
  } catch (e) {
    console.error("admin: createUser (e-mail duplicado?)", e);
  }
  revalidatePath("/admin");
}

export async function toggleActiveAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (id) await setActive(id, active);
  revalidatePath("/admin");
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (id && password.length >= 6) await setPassword(id, hashPassword(password));
  revalidatePath("/admin");
}
