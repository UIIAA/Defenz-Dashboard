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
