import { BarChart3 } from 'lucide-react';

export default function AtividadePage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 bg-slate-50 rounded-full mb-4">
        <BarChart3 size={32} className="text-slate-300" />
      </div>
      <h2 className="text-xl font-semibold text-slate-700 mb-2">Atividade por Vendedor</h2>
      <p className="text-sm text-slate-400 max-w-md">
        Dashboard de atividade diaria por vendedor. Em breve.
      </p>
      <span className="mt-4 text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 font-medium">
        V4.0 — Em desenvolvimento
      </span>
    </div>
  );
}
