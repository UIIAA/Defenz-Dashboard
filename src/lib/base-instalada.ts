import { isClosedWon } from './metrics';
import { identidadeEmpresa, cnpjCanonico, formatarCnpj } from './cnpj';
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
  // Agrupa por IDENTIDADE (CNPJ, com fallback para nome normalizado), não pelo rótulo.
  // Antes agrupava pelo nome cru: o mesmo cliente com o nome grafado de dois jeitos virava
  // dois clientes. Mais de um negócio para a mesma empresa é NORMAL (medido: Estaleiro com
  // duas vendas reais de 200 endpoints) — some as licenças, conta 1 cliente, `negocios` 2.
  const byIdent = new Map<string, BaseInstaladaCliente>();
  const tagsByIdent = new Map<string, Set<string>>();
  for (const d of deals) {
    if (!isClosedWon(String(d.stage || ''))) continue;
    const ident = identidadeEmpresa(d);
    const empresa = String(d.empresa || '').trim() || String(d.nome || '').trim() || '—';
    const lic = Number(d.licencas) || 0;
    const cnpj = cnpjCanonico(d.cnpj);
    const cur = byIdent.get(ident) ?? {
      empresa, // rótulo do primeiro negócio visto; o CNPJ é que manda na identidade
      cnpj: cnpj ? formatarCnpj(cnpj) : undefined,
      licencas: 0,
      negocios: 0,
      setup: 'nao-iniciado' as SetupStatus,
    };
    cur.licencas += lic; cur.negocios += 1;
    byIdent.set(ident, cur);
    const tagSet = tagsByIdent.get(ident) ?? new Set<string>();
    for (const t of norm(d.tags)) tagSet.add(t);
    tagsByIdent.set(ident, tagSet);
  }
  for (const [ident, cur] of byIdent) {
    cur.setup = classify(tagsByIdent.get(ident) ?? new Set<string>());
  }
  const clientes = [...byIdent.values()].sort((a, b) => b.licencas - a.licencas);
  const totalClientes = clientes.length;
  const totalLicencas = clientes.reduce((s, c) => s + c.licencas, 0);
  const setupConcluidoPct = totalClientes
    ? clientes.filter(c => c.setup === 'na-console').length / totalClientes
    : 0;
  return { clientes, totalClientes, totalLicencas, setupConcluidoPct };
}
