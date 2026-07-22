# Meta em "Receita por Canal" — Implementation Plan (Spec 2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Add per-channel monthly targets (scaled to the selected period) + a consolidated attainment to the `/` "Receita por Canal" section, editable inline by admins, persisted in Neon, applying the color-rule Padrões. Spec: [`feature-metas-canal.md`](../../features/feature-metas-canal.md).

**Architecture:** Targets live in a Neon table `channel_targets` (3 rows). A thin repo (`src/lib/metas-canal.ts`) reads/writes them over the existing `db()` (Neon lazy, `src/lib/users.ts` pattern). Pure scaling (`metaPeriodo`) is unit-tested. `GET/PUT /api/metas-canal` (PUT gated to `role==='admin'` via `verifySession`). `ExecutiveDashboard` fetches targets, scales by `dateRange` days, renders meta bars + consolidated + inline editor.

**Tech Stack:** Next.js 16, Neon serverless (`@neondatabase/serverless`), vitest, Tailwind.

**Test commands:** `npx vitest run src/lib/metas-canal.test.ts`; `npm run test`; `npm run build`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `db/migrations/0002_channel_targets.sql` | table + seed | Create |
| `scripts/users.mjs` | apply 0002 in `migrate()` | Modify |
| `src/lib/types.ts` | `ChannelTarget`, `ChannelTargets`, meta fields on canal item | Modify |
| `src/lib/metas-canal.ts` | pure `metaPeriodo`, `diasNoPeriodo`; repo `getChannelTargets`/`setChannelTargets` | Create |
| `src/lib/metas-canal.test.ts` | scaling math | Create |
| `src/app/api/metas-canal/route.ts` | GET (logged) + PUT (admin) | Create |
| `src/components/dashboard/ChannelTargetsEditor.tsx` | inline edit form | Create |
| `src/components/dashboard/ExecutiveDashboard.tsx` | meta bars + consolidado + editor + CANAL_COLORS | Modify |
| `src/hooks/useChannelTargets.ts` | fetch targets | Create |

---

## Task 1: Neon table `channel_targets`

**Files:** Create `db/migrations/0002_channel_targets.sql`; Modify `scripts/users.mjs`.

- [ ] **Step 1:** Create `db/migrations/0002_channel_targets.sql`:

```sql
create table if not exists channel_targets (
  categoria    text primary key check (categoria in ('direto','parceiro','securisoft')),
  valor_mensal numeric not null default 0,
  updated_at   timestamptz not null default now(),
  updated_by   text
);
insert into channel_targets (categoria) values ('direto'),('parceiro'),('securisoft')
  on conflict (categoria) do nothing;
```

- [ ] **Step 2:** In `scripts/users.mjs` `migrate()`, apply `0002_channel_targets.sql` after `0001_auth.sql` (read the file, split statements, run — mirror the existing 0001 handling).

- [ ] **Step 3 (verify):** `node scripts/users.mjs migrate` → "migrate ok". Re-run → idempotent (no error).

- [ ] **Step 4: Commit** `git add db/migrations/0002_channel_targets.sql scripts/users.mjs && git commit -m "feat(db): tabela channel_targets (metas por canal)"`

---

## Task 2: Pure scaling + repo (metas-canal.ts)

**Files:** Create `src/lib/metas-canal.ts`, `src/lib/metas-canal.test.ts`; Modify `src/lib/types.ts`.

- [ ] **Step 1:** Types in `src/lib/types.ts`:

```ts
export type CanalCategoria = 'direto' | 'parceiro' | 'securisoft';
export interface ChannelTarget { categoria: CanalCategoria; valor_mensal: number; updated_at?: string; updated_by?: string | null; }
export type ChannelTargets = Record<CanalCategoria, number>; // valor_mensal por canal
```

- [ ] **Step 2: Failing test** (`src/lib/metas-canal.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { metaPeriodo, diasNoPeriodo } from './metas-canal';

describe('escala de meta', () => {
  it('diasNoPeriodo inclui as duas pontas', () => {
    expect(diasNoPeriodo('2026-07-01', '2026-07-31')).toBe(31);
    expect(diasNoPeriodo('2026-07-10', '2026-07-10')).toBe(1);
  });
  it('metaPeriodo = mensal × dias / 30 arredondado', () => {
    expect(metaPeriodo(30000, 30)).toBe(30000);
    expect(metaPeriodo(30000, 15)).toBe(15000);
    expect(metaPeriodo(40000, 56)).toBe(Math.round(40000 * 56 / 30));
  });
  it('mensal 0 → 0', () => { expect(metaPeriodo(0, 56)).toBe(0); });
});
```

- [ ] **Step 3: Run — FAIL.** `npx vitest run src/lib/metas-canal.test.ts`

- [ ] **Step 4: Implement** `src/lib/metas-canal.ts`:

```ts
import { db } from './db';
import type { CanalCategoria, ChannelTarget, ChannelTargets } from './types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function diasNoPeriodo(from: string, to: string): number {
  if (!DATE.test(from) || !DATE.test(to)) return 0;
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((b - a) / 86400000) + 1;
}
export function metaPeriodo(mensal: number, dias: number): number {
  return Math.round((Number(mensal) || 0) * dias / 30);
}
export async function getChannelTargets(): Promise<ChannelTargets> {
  const rows = (await db()`select categoria, valor_mensal from channel_targets`) as ChannelTarget[];
  const out: ChannelTargets = { direto: 0, parceiro: 0, securisoft: 0 };
  for (const r of rows) out[r.categoria] = Number(r.valor_mensal) || 0;
  return out;
}
export async function setChannelTargets(t: ChannelTargets, updatedBy: string): Promise<void> {
  const cats: CanalCategoria[] = ['direto', 'parceiro', 'securisoft'];
  for (const c of cats) {
    await db()`update channel_targets set valor_mensal = ${t[c]}, updated_at = now(), updated_by = ${updatedBy} where categoria = ${c}`;
  }
}
```

- [ ] **Step 5: Run — PASS.** Then **Commit** `git add src/lib/metas-canal.ts src/lib/metas-canal.test.ts src/lib/types.ts && git commit -m "feat(metas-canal): escala pura + repo Neon de metas por canal"`

---

## Task 3: API route GET/PUT (admin gate)

**Files:** Create `src/app/api/metas-canal/route.ts`.

- [ ] **Step 1:** Implement, mirroring `/api/metas` auth + the admin gate used by `/admin`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getChannelTargets, setChannelTargets } from '@/lib/metas-canal';
import type { ChannelTargets } from '@/lib/types';

export async function GET(req: NextRequest) {
  if (!(await verifySession(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getChannelTargets());
}
export async function PUT(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as Partial<ChannelTargets>;
  const clean = (n: unknown) => Math.max(0, Number(n) || 0);
  await setChannelTargets({ direto: clean(body.direto), parceiro: clean(body.parceiro), securisoft: clean(body.securisoft) }, session.email);
  return NextResponse.json(await getChannelTargets());
}
```

- [ ] **Step 2 (verify):** `npm run build` green. Via browser preview logged in as admin, `PUT` returns 200; construct a member cookie / logged-out → 403/401 (check `read_network_requests`).

- [ ] **Step 3: Commit** `git add src/app/api/metas-canal/route.ts && git commit -m "feat(api): /api/metas-canal GET (logado) + PUT (admin)"`

---

## Task 4: Hook + scaled metas in ReceitaPorCanalSection

**Files:** Create `src/hooks/useChannelTargets.ts`; Modify `src/components/dashboard/ExecutiveDashboard.tsx`.

- [ ] **Step 1:** `useChannelTargets` — `fetch('/api/metas-canal')` → `ChannelTargets | null`, with a `reload()`.

- [ ] **Step 2:** In `ExecutiveDashboard`, get `dateRange` (already present via `useDateRange`). Derive `{from,to}` for the current range (reuse whatever decode the page already uses for the exec filter; if it's a preset, resolve to dates). Compute `metaCanal[cat] = metaPeriodo(targets[cat], diasNoPeriodo(from,to))`. Pass `targets`, `metaCanal` into `ReceitaPorCanalSection`.

- [ ] **Step 3:** In `ReceitaPorCanalSection`, per channel card add: `meta = metaCanal[categoria]`, `pct = meta>0 ? valor_fechado/meta : null`, attainment bar with **status color** via `grade(valor_fechado, meta, meta).cor` mapped to `bg-emerald-500 / bg-amber-500 / bg-red-500` (meta 0 → hide bar). Replace `CANAL_COLORS` with neutral dots: `direto:#334155`, `parceiro:#64748b`, `securisoft:#cbd5e1`.

- [ ] **Step 4:** Add a **consolidado Total** row: `Σ valor_fechado (receita.total_valor) vs Σ metaCanal`, attainment bar + `% da meta do período`, same status colors.

- [ ] **Step 5 (browser verify):** `/` shows meta bars per channel + Total; SecuriSoft no longer red; status bars amber/green. Screenshot.

- [ ] **Step 6: Commit** `git commit -am "feat(metas-canal): metas escaladas + consolidado + regra de cor em Receita por Canal"`

---

## Task 5: Inline editor (admin)

**Files:** Create `src/components/dashboard/ChannelTargetsEditor.tsx`; Modify `ExecutiveDashboard.tsx`.

- [ ] **Step 1:** Pencil button in the section header, rendered only when the session is admin. The page must know the role: expose it (e.g. a small `/api/whoami` or read from an existing session context; if none, add a `role` field to the dashboard data fetch). Simplest: `useChannelTargets` also returns `canEdit` from a lightweight `GET /api/whoami` returning `{ role }` (create it, `verifySession`). Pencil visible only if `role==='admin'`.

- [ ] **Step 2:** `ChannelTargetsEditor` — 3 BRL number inputs (monthly target per channel, seeded from `targets`), Salvar/Cancelar. Salvar → `PUT /api/metas-canal` → on 200 `reload()` targets + exit edit. Validation: `>= 0`.

- [ ] **Step 3 (browser verify):** as admin, pencil → edit → save → values persist after reload; as member, no pencil. Screenshot.

- [ ] **Step 4: Commit** `git commit -am "feat(metas-canal): edição inline das metas (admin), persistida no Neon"`

---

## Final verification
- [ ] `npm run test` + `npm run build` green.
- [ ] Browser: metas per channel scale when the date filter changes; Total consolidado correct; admin edits persist; member can't edit; no alarm-red on SecuriSoft.

## Self-review (coverage)
Spec §1 meta+atingimento→T4; §2 consolidado→T4; §3 cor→T4; §4 edição inline→T5; §5 Neon+API→T1/T2/T3. Aberto no spec (escala /30, %meta vs %total) seguem as escolhas default do plano (T2/T4). Dependência: base auth/Neon já na branch.
