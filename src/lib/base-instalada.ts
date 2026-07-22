import { isClosedWon } from './metrics';
import type { RawDeal, BaseInstalada, BaseInstaladaCliente, SetupStatus } from './types';

const norm = (raw: unknown) =>
  String(raw || '').split(/[;,]/).map(s => s.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean);

function classify(tags: Set<string>): SetupStatus {
  if (tags.has('cliente na console')) return 'na-console';
  if (tags.has('cliente não está console') || tags.has('cliente recusou')) return 'recusou';
  if (tags.size) return 'em-setup';
  return 'nao-iniciado';
}

export function aggregateBaseInstalada(deals: RawDeal[]): BaseInstalada {
  const byEmpresa = new Map<string, BaseInstaladaCliente>();
  const tagsByEmpresa = new Map<string, Set<string>>();
  for (const d of deals) {
    if (!isClosedWon(String(d.stage || ''))) continue;
    const empresa = String(d.empresa || '').trim() || String(d.nome || '').trim() || '—';
    const lic = Number(d.licencas) || 0;
    const cur = byEmpresa.get(empresa) ?? { empresa, licencas: 0, negocios: 0, setup: 'nao-iniciado' as SetupStatus };
    cur.licencas += lic; cur.negocios += 1;
    byEmpresa.set(empresa, cur);
    const tagSet = tagsByEmpresa.get(empresa) ?? new Set<string>();
    for (const t of norm(d.tags)) tagSet.add(t);
    tagsByEmpresa.set(empresa, tagSet);
  }
  for (const [empresa, cur] of byEmpresa) {
    cur.setup = classify(tagsByEmpresa.get(empresa) ?? new Set<string>());
  }
  const clientes = [...byEmpresa.values()].sort((a, b) => b.licencas - a.licencas);
  const totalClientes = clientes.length;
  const totalLicencas = clientes.reduce((s, c) => s + c.licencas, 0);
  const setupConcluidoPct = totalClientes
    ? clientes.filter(c => c.setup === 'na-console').length / totalClientes
    : 0;
  return { clientes, totalClientes, totalLicencas, setupConcluidoPct };
}
