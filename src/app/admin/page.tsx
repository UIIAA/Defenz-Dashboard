import Link from "next/link";
import { verifySession } from "@/lib/auth";
import { listUsers, listRecentAccess } from "@/lib/users";
import { createUserAction, toggleActiveAction, resetPasswordAction } from "./actions";

// Sempre fresco (auditoria ao vivo) + nunca prerender estático.
export const dynamic = "force-dynamic";

const fmt = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
};

const EVENT_STYLE: Record<string, { label: string; cls: string }> = {
  login_ok: { label: "entrou", cls: "bg-emerald-50 text-emerald-600" },
  login_fail: { label: "falhou", cls: "bg-red-50 text-red-600" },
  logout: { label: "saiu", cls: "bg-slate-100 text-slate-500" },
};

const card = "rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5";
const input = "px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none";

export default async function AdminPage() {
  const session = await verifySession(); // middleware garante admin; usamos só o nome
  const [users, access] = await Promise.all([listUsers(), listRecentAccess(50)]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 font-display">
              Administração
            </h1>
            <p className="text-red-600 text-sm font-bold tracking-wide mt-1">
              USUÁRIOS &amp; ACESSOS · {session?.name}
            </p>
          </div>
          <Link href="/" className="text-sm text-slate-500 hover:text-red-600 transition-colors">
            ← voltar ao dashboard
          </Link>
        </div>

        {/* Novo usuário */}
        <div className={card}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-3">Novo usuário</h2>
          <form action={createUserAction} className="flex flex-wrap items-end gap-3">
            <input name="email" type="email" required placeholder="e-mail" className={input} />
            <input name="name" type="text" required placeholder="nome" className={input} />
            <input name="password" type="text" required minLength={6} placeholder="senha inicial (mín. 6)" className={input} />
            <select name="role" className={input} defaultValue="member">
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button type="submit" className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              Criar
            </button>
          </form>
        </div>

        {/* Usuários */}
        <div className={`${card} overflow-hidden`}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-3">Usuários ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3 font-semibold">Nome</th>
                  <th className="py-2 pr-3 font-semibold">E-mail</th>
                  <th className="py-2 pr-3 font-semibold">Papel</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Último acesso</th>
                  <th className="py-2 pr-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 align-middle">
                    <td className="py-2.5 pr-3 font-medium text-slate-900">{u.name}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{u.email}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={u.active ? "text-emerald-600" : "text-slate-400"}>{u.active ? "ativo" : "inativo"}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-400 tabular-nums">{fmt(u.last_login_at)}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-3">
                        <form action={toggleActiveAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="active" value={String(!u.active)} />
                          <button type="submit" className="text-xs text-slate-500 hover:text-red-600 transition-colors">
                            {u.active ? "desativar" : "reativar"}
                          </button>
                        </form>
                        <form action={resetPasswordAction} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={u.id} />
                          <input name="password" type="text" required minLength={6} placeholder="nova senha" className="px-2 py-1 border border-slate-200 rounded text-xs w-28 focus:ring-1 focus:ring-red-400 outline-none" />
                          <button type="submit" className="text-xs text-slate-500 hover:text-red-600 transition-colors">resetar</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auditoria */}
        <div className={`${card} overflow-hidden`}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-3">Acessos recentes (últimos {access.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3 font-semibold">Quando</th>
                  <th className="py-2 pr-3 font-semibold">Evento</th>
                  <th className="py-2 pr-3 font-semibold">E-mail</th>
                  <th className="py-2 pr-3 font-semibold">Nome</th>
                  <th className="py-2 pr-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {access.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">Sem registros de acesso ainda.</td></tr>
                ) : (
                  access.map((a) => {
                    const ev = EVENT_STYLE[a.event] ?? { label: a.event, cls: "bg-slate-100 text-slate-500" };
                    return (
                      <tr key={a.id} className="border-b border-slate-50">
                        <td className="py-2 pr-3 text-slate-400 tabular-nums">{fmt(a.created_at)}</td>
                        <td className="py-2 pr-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ev.cls}`}>{ev.label}</span></td>
                        <td className="py-2 pr-3 tabular-nums">{a.email}</td>
                        <td className="py-2 pr-3">{a.name ?? "—"}</td>
                        <td className="py-2 pr-3 text-slate-400 tabular-nums">{a.ip ?? "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
