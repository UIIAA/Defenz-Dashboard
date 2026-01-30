"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          Senha de Acesso
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-slate-900 bg-white placeholder-slate-400"
          placeholder="Digite a senha"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {pending ? "Autenticando..." : "Entrar"}
      </button>
    </form>
  );
}
