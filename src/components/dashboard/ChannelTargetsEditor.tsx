"use client";

// feature-metas-canal (Spec 2, Task 5) — edição inline das 3 metas mensais por
// canal (Direto/Parceiro/SecuriSoft), só renderizado pra admin (gate no chamador).
// Salvar envia SEMPRE os 3 valores (seed de `targets` cobre os campos não
// tocados) — protege contra zerar um canal por payload parcial, mesmo que o
// backend também recuse (hardening em /api/metas-canal PUT).

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import type { ChannelTargets, CanalCategoria } from '@/lib/types';

const CANAL_LABELS: Record<CanalCategoria, string> = {
  direto: 'Direto',
  parceiro: 'Parceiro',
  securisoft: 'SecuriSoft',
};

const CANAIS: CanalCategoria[] = ['direto', 'parceiro', 'securisoft'];

export function ChannelTargetsEditor({
  targets,
  onCancel,
  onSaved,
}: {
  targets: ChannelTargets;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<CanalCategoria, string>>({
    direto: String(targets.direto ?? 0),
    parceiro: String(targets.parceiro ?? 0),
    securisoft: String(targets.securisoft ?? 0),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (cat: CanalCategoria, value: string) => {
    setValues((prev) => ({ ...prev, [cat]: value }));
  };

  const handleSave = async () => {
    setError(null);

    const parsed: Partial<ChannelTargets> = {};
    for (const cat of CANAIS) {
      const n = Number(values[cat]);
      if (!Number.isFinite(n) || n < 0) {
        setError(`Valor inválido em ${CANAL_LABELS[cat]} (precisa ser um número ≥ 0).`);
        return;
      }
      parsed[cat] = n;
    }

    // Sempre os 3 valores — nunca deixa um canal de fora do payload.
    const body: ChannelTargets = {
      direto: parsed.direto ?? targets.direto,
      parceiro: parsed.parceiro ?? targets.parceiro,
      securisoft: parsed.securisoft ?? targets.securisoft,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/metas-canal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Não foi possível salvar as metas. Tente novamente.');
        return;
      }
      onSaved();
    } catch {
      setError('Não foi possível salvar as metas. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
      <div className="grid grid-cols-3 gap-4">
        {CANAIS.map((cat) => (
          <label key={cat} className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {CANAL_LABELS[cat]} · meta mensal
            </span>
            <div className="mt-1 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <span className="text-xs text-slate-400">R$</span>
              <input
                type="number"
                min={0}
                step="100"
                inputMode="decimal"
                value={values[cat]}
                onChange={(e) => handleChange(cat, e.target.value)}
                disabled={saving}
                className="w-full text-sm font-semibold text-slate-700 outline-none tabular-nums disabled:opacity-50"
              />
            </div>
          </label>
        ))}
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all disabled:opacity-50"
        >
          <X size={13} /> Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Salvar
        </button>
      </div>
    </div>
  );
}
