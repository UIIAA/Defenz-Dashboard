# Drill-down da base instalada — Implementation Plan (Spec 3)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Turn the `/diario` "Base instalada" card into a clickable drill-down listing all ~64 clients (won deals aggregated by company) ordered by licenses, from the `deals` sheet. Spec: [`feature-base-instalada-drilldown.md`](../../features/feature-base-instalada-drilldown.md). Phase 1 only (segment = phase 2).

**Architecture:** Pure aggregation (`src/lib/base-instalada.ts`) over closed-won `deals` (by `empresa`, sum `licencas`), unit-tested. A route `/api/base-instalada` serves it (`verifySession` + `fetchFromSheets('deals')`). A drawer component renders the ranked list with search, opened from the existing card.

**Tech Stack:** Next.js 16, vitest, Tailwind. Reuses `isClosedWon` (`src/lib/metrics.ts`), `fetchFromSheets` (`src/lib/sheets.ts`).

**Test commands:** `npx vitest run src/lib/base-instalada.test.ts`; `npm run test`; `npm run build`.

---

## Task 0 (PREREQUISITE — data): add `licencas` to the `deals` export

**Owner:** n8n workflow `QjnzGicZHIPBNN1g`, node `Format Deals Raw` (Marcos or via n8n MCP, needs approval to edit the live workflow).

- [ ] Add `licencas: Number(d.<campo_licencas_zoho>) || 0` to the exported deal object so the `deals` sheet gains a `licencas` column. The snapshot already reads this Zoho field for `base_top_contas`; reuse the same field name.
- [ ] Run the workflow once; confirm the `deals` tab now has a `licencas` column populated (spot-check INFRACOMMERCE ≈ 2000).

> Until this lands, `licencas` is absent → aggregation yields 0s and ordering is flat. Code tasks below tolerate that (default 0) and are testable with synthetic data now; the browser check waits on this.

---

## Task 1: Aggregation (base-instalada.ts)

**Files:** Create `src/lib/base-instalada.ts`, `src/lib/base-instalada.test.ts`; Modify `src/lib/types.ts`.

- [ ] **Step 1:** Types in `src/lib/types.ts` — add `licencas?: number | string;` to `RawDeal`, and:

```ts
export interface BaseInstaladaCliente { empresa: string; licencas: number; negocios: number; }
export interface BaseInstalada { clientes: BaseInstaladaCliente[]; totalClientes: number; totalLicencas: number; }
```

- [ ] **Step 2: Failing test** (`src/lib/base-instalada.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { aggregateBaseInstalada } from './base-instalada';
import type { RawDeal } from './types';

const won = (empresa: string, licencas: number): RawDeal =>
  ({ stage: 'Fechado Ganho', empresa, licencas } as RawDeal);

describe('aggregateBaseInstalada', () => {
  it('agrupa por empresa, soma licenças, ordena desc, ignora não-ganhos', () => {
    const deals: RawDeal[] = [
      won('ACME', 100), won('ACME', 50),            // 2 negócios, 150
      won('BETA', 300),
      { stage: 'Fechado Perdido', empresa: 'GAMA', licencas: 999 } as RawDeal,
    ];
    const r = aggregateBaseInstalada(deals);
    expect(r.totalClientes).toBe(2);
    expect(r.totalLicencas).toBe(450);
    expect(r.clientes[0]).toEqual({ empresa: 'BETA', licencas: 300, negocios: 1 });
    expect(r.clientes[1]).toEqual({ empresa: 'ACME', licencas: 150, negocios: 2 });
  });
  it('empresa vazia cai para "—" e não quebra', () => {
    const r = aggregateBaseInstalada([{ stage: 'Fechado Ganho', empresa: '', licencas: 10 } as RawDeal]);
    expect(r.clientes[0].empresa).toBe('—');
  });
});
```

- [ ] **Step 3: Run — FAIL.** `npx vitest run src/lib/base-instalada.test.ts`

- [ ] **Step 4: Implement** `src/lib/base-instalada.ts`:

```ts
import { isClosedWon } from './metrics';
import type { RawDeal, BaseInstalada, BaseInstaladaCliente } from './types';

export function aggregateBaseInstalada(deals: RawDeal[]): BaseInstalada {
  const byEmpresa = new Map<string, BaseInstaladaCliente>();
  for (const d of deals) {
    if (!isClosedWon(String(d.stage || ''))) continue;
    const empresa = String(d.empresa || '').trim() || String(d.nome || '').trim() || '—';
    const lic = Number(d.licencas) || 0;
    const cur = byEmpresa.get(empresa) ?? { empresa, licencas: 0, negocios: 0 };
    cur.licencas += lic; cur.negocios += 1;
    byEmpresa.set(empresa, cur);
  }
  const clientes = [...byEmpresa.values()].sort((a, b) => b.licencas - a.licencas);
  return { clientes, totalClientes: clientes.length, totalLicencas: clientes.reduce((s, c) => s + c.licencas, 0) };
}
```

- [ ] **Step 5: Run — PASS.** **Commit** `git add src/lib/base-instalada.ts src/lib/base-instalada.test.ts src/lib/types.ts && git commit -m "feat(base-instalada): agregação por empresa dos fechado-ganho"`

---

## Task 2: API route

**Files:** Create `src/app/api/base-instalada/route.ts`.

- [ ] **Step 1:** Implement (mirror `/api/metas` auth + `fetchFromSheets`):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { fetchFromSheets } from '@/lib/sheets';
import { aggregateBaseInstalada } from '@/lib/base-instalada';
import type { RawDeal } from '@/lib/types';

export async function GET(req: NextRequest) {
  if (!(await verifySession(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const deals = (await fetchFromSheets('deals')) as RawDeal[];
  return NextResponse.json(aggregateBaseInstalada(deals));
}
```

- [ ] **Step 2 (verify):** `npm run build`; browser preview logged in → route returns `{clientes,totalClientes,totalLicencas}`; **validate `totalLicencas` ≈ 5968 / `totalClientes` ≈ 64** against the snapshot (flag if off → double-count of renewals; see spec §Itens abertos).

- [ ] **Step 3: Commit** `git add src/app/api/base-instalada/route.ts && git commit -m "feat(api): /api/base-instalada"`

---

## Task 3: Drawer + clickable card

**Files:** Create `src/components/diario/BaseInstaladaDrawer.tsx`; Modify `src/components/diario/ResumoDiarioDashboard.tsx`.

- [ ] **Step 1:** `BaseInstaladaDrawer` — right-side panel (fixed, `translate-x` transition), fetches `/api/base-instalada` on open. Header: `{totalClientes} clientes · {totalLicencas.toLocaleString('pt-BR')} licenças`. Search input filters `clientes` by `empresa` (case-insensitive). List rows: position · empresa (truncate) · mini bar (`licencas / max`) · `licencas` + `% da base`. Colors neutral (grafite `#334155`), §Padrões. A disabled "Segmento — FASE 2" chip placeholder.

- [ ] **Step 2:** In `ResumoDiarioDashboard`, make the "Base instalada" card clickable (button/`onClick`) → opens the drawer; add a "ver todas as N →" affordance.

- [ ] **Step 3 (browser verify — after Task 0 lands):** click card → drawer lists all clients ordered by license; search filters; layout clean. Screenshot. (Before Task 0, licenças are 0 — verify the drawer renders and search works with the flat data.)

- [ ] **Step 4: Commit** `git commit -am "feat(base-instalada): drawer com lista completa por licença + busca"`

---

## Final verification
- [ ] `npm run test` + `npm run build` green.
- [ ] After Task 0: `totalLicencas`/`totalClientes` reconcile with the snapshot; drawer ranks correctly.

## Self-review (coverage)
Spec §1 dado→T0; §2 agregação→T1; §3 UI drawer→T3; API→T2. Fase 2 (segmento) e 3 (gerenciado) fora deste plano por decisão. Risco de contagem dupla de renovação registrado no verify de T2.
