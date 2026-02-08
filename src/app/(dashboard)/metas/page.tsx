import { Target } from 'lucide-react';

export default function MetasPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 bg-slate-50 rounded-full mb-4">
        <Target size={32} className="text-slate-300" />
      </div>
      <h2 className="text-xl font-semibold text-slate-700 mb-2">Metas Semanais</h2>
      <p className="text-sm text-slate-400 max-w-md">
        Dashboard TV com metas semanais e auto-refresh. Em breve.
      </p>
      <span className="mt-4 text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 font-medium">
        V5.0 — Em desenvolvimento
      </span>
    </div>
  );
}
