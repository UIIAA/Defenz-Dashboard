import { OportunidadesDashboard } from '@/components/oportunidades/OportunidadesDashboard';

// feature-semaforo-oportunidades. SEM guard de super_admin, ao contrário de `/` e
// `/operacional`: a tela é do time — quem precisa preencher o semáforo é o vendedor.
// Por isso a rota de API não envia `comissao_valor` (spec §5.2).
export default function OportunidadesPage() {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900 font-display">Oportunidades</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Negócios abertos no Zoho — exceto fechados e Contato Futuro
        </p>
      </div>
      <OportunidadesDashboard />
    </div>
  );
}
