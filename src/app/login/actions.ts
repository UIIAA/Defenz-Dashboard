"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSession,
  getSessionCookieOptions,
  constantTimeEqual,
} from "@/lib/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0) {
    return { error: "Informe a senha." };
  }

  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  if (!expectedPassword) {
    // Generic error — do not reveal misconfiguration details
    return { error: "Senha incorreta." };
  }

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeEqual(password, expectedPassword)) {
    return { error: "Senha incorreta." };
  }

  const token = await createSession();
  if (!token) {
    return { error: "Erro interno. Tente novamente." };
  }

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
