# Indicador "setup concluído (taggeado)" — Implementation Plan (Spec 4)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Show, inside the base-instalada drawer (Spec 3), the % of won clients with setup completed (tag `cliente na console`) + a per-client status badge + a "só pendentes" filter. Spec: [`feature-indicador-setup-taggeado.md`](../../features/feature-indicador-setup-taggeado.md).

**Architecture:** Extend `aggregateBaseInstalada` (Spec 3) to classify each client's setup status from its won deals' `tags` and expose `setupConcluidoPct`. Pure + unit-tested. The drawer renders the headline %, badges, and filter.

**Tech Stack:** vitest, Tailwind. Depends on Spec 3 (`src/lib/base-instalada.ts`, `BaseInstaladaDrawer.tsx`).

**Test commands:** `npx vitest run src/lib/base-instalada.test.ts`; `npm run test`.

---

## Task 1: Setup status in aggregation

**Files:** Modify `src/lib/base-instalada.ts`, `src/lib/base-instalada.test.ts`, `src/lib/types.ts`.

Status from the client's won-deal tags (normalize: split `;`/`,`, trim, lowercase, collapse spaces):
- `na-console` — any tag exactly `cliente na console`
- `recusou` — else any tag `cliente não está console` or `cliente recusou`
- `em-setup` — else any tag present
- `nao-iniciado` — else no tag

Exact match on `cliente na console` (must NOT match `cliente não está console`).

- [ ] **Step 1:** Types in `src/lib/types.ts`:

```ts
export type SetupStatus = 'na-console' | 'em-setup' | 'recusou' | 'nao-iniciado';
```

Add `setup: SetupStatus;` to `BaseInstaladaCliente` and `setupConcluidoPct: number;` (0..1) to `BaseInstalada`.

- [ ] **Step 2: Failing test** (append to `src/lib/base-instalada.test.ts`):

```ts
const wonTag = (empresa: string, tags: string): RawDeal =>
  ({ stage: 'Fechado Ganho', empresa, licencas: 10, tags } as RawDeal);

describe('setup status', () => {
  it('classifica por tag e calcula % na console', () => {
    const r = aggregateBaseInstalada([
      wonTag('A', 'cliente na console'),
      wonTag('B', 'enviar health check; hash e-mail enviado'),
      wonTag('C', 'cliente não está console'),
      wonTag('D', ''),
    ]);
    const by = Object.fromEntries(r.clientes.map(c => [c.empresa, c.setup]));
    expect(by.A).toBe('na-console');
    expect(by.B).toBe('em-setup');
    expect(by.C).toBe('recusou');
    expect(by.D).toBe('nao-iniciado');
    expect(r.setupConcluidoPct).toBeCloseTo(0.25); // 1 de 4
  });
  it('não confunde "na console" com "não está console"', () => {
    const r = aggregateBaseInstalada([wonTag('X', 'cliente não está console')]);
    expect(r.clientes[0].setup).toBe('recusou');
  });
});
```

- [ ] **Step 3: Run — FAIL.** `npx vitest run src/lib/base-instalada.test.ts -t "setup status"`

- [ ] **Step 4: Implement.** In `base-instalada.ts`, accumulate a `Set<string>` of normalized tags per empresa while aggregating, then classify:

```ts
const norm = (raw: unknown) => String(raw || '').split(/[;,]/).map(s => s.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean);
function classify(tags: Set<string>): SetupStatus {
  if (tags.has('cliente na console')) return 'na-console';
  if (tags.has('cliente não está console') || tags.has('cliente recusou')) return 'recusou';
  if (tags.size) return 'em-setup';
  return 'nao-iniciado';
}
```

Extend the loop to collect `norm(d.tags)` into a per-empresa `Set`, set `cur.setup = classify(set)` after the loop, and compute `setupConcluidoPct = totalClientes ? (clientes.filter(c => c.setup==='na-console').length / totalClientes) : 0`.

- [ ] **Step 5: Run — PASS** (all base-instalada tests). **Commit** `git add src/lib/base-instalada.ts src/lib/base-instalada.test.ts src/lib/types.ts && git commit -m "feat(base-instalada): status de setup por cliente + % concluído (tags)"`

---

## Task 2: Drawer — headline %, badges, filter

**Files:** Modify `src/components/diario/BaseInstaladaDrawer.tsx` (from Spec 3).

- [ ] **Step 1:** Headline at drawer top: `Setup concluído: {Math.round(pct*100)}%` + `{n} de {total} na console` + thin progress bar (emerald).

- [ ] **Step 2:** Per-row badge by `setup` (§Padrões colors): `na-console`→emerald "Na console ✓"; `em-setup`→amber "Em setup"; `recusou`→red "Não está/recusou"; `nao-iniciado`→slate "Não iniciado".

- [ ] **Step 3:** A "só pendentes" toggle → filters out `na-console` rows (work list). Combine with the existing search.

- [ ] **Step 4 (browser verify):** drawer shows ~40% headline, badges match, "só pendentes" hides completed. Screenshot.

- [ ] **Step 5: Commit** `git commit -am "feat(base-instalada): indicador de setup no drawer (headline + badges + filtro)"`

---

## Final verification
- [ ] `npm run test` green. Browser: headline % matches the badge counts; red only on recusou/não-está.

## Self-review (coverage)
Spec §1 métrica→T1; §2 badges→T2; §3 UI→T2. Matching exato coberto pelo 2º teste. Aberto (any-vs-all na agregação) segue "any" do plano — cliente concluído se qualquer negócio dele está na console.
