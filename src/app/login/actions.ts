"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import { verifyPassword, DUMMY_HASH } from "@/lib/password";
import { findActiveUserByEmail, recordLogin, logAccess } from "@/lib/users";
import { throttleKey, isBlocked, recordFailure, clearFailures } from "@/lib/login-throttle";

export interface LoginState {
  error?: string;
}

const GENERIC = "E-mail ou senha incorretos.";

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent") || null;
  const key = throttleKey(email, ip ?? "unknown");

  if (isBlocked(key)) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
  }

  let user;
  try {
    user = await findActiveUserByEmail(email);
  } catch (e) {
    console.error("login: erro ao consultar o banco", e);
    return { error: "Erro interno. Tente novamente." };
  }

  // Roda scrypt SEMPRE (contra DUMMY_HASH se o e-mail não existe) → tempo constante,
  // não vaza quais e-mails existem (anti-enumeração/timing).
  const ok = verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !ok) {
    recordFailure(key);
    await logAccess({ userId: user?.id ?? null, email, event: "login_fail", ip, userAgent }).catch(
      (e) => console.error("login: falha ao gravar auditoria", e)
    );
    return { error: GENERIC };
  }

  const token = await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  if (!token) {
    return { error: "Erro interno. Tente novamente." };
  }

  clearFailures(key);
  await recordLogin(user.id).catch((e) => console.error("login: falha ao gravar last_login", e));
  await logAccess({ userId: user.id, email, event: "login_ok", ip, userAgent }).catch((e) =>
    console.error("login: falha ao gravar auditoria", e)
  );

  const opts = getSessionCookieOptions();
  const cookieStore = await cookies();
  cookieStore.set(opts.name, token, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: opts.maxAge,
  });

  redirect("/");
}
