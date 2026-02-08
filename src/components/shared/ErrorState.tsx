"use client";

import { AlertTriangle } from 'lucide-react';
import { MagicCard } from '@/components/ui/MagicCard';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const ErrorState = ({ error, onRetry }: ErrorStateProps) => (
  <MagicCard className="border-red-200 bg-red-50 text-center py-12">
    <AlertTriangle className="mx-auto mb-4 text-red-500" size={32} strokeWidth={1.5} />
    <h3 className="font-medium text-red-900 text-lg font-display">Erro de Sincronização</h3>
    <p className="text-red-700/60 mb-6 text-sm">{error}</p>
    <button onClick={onRetry} className="px-6 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg transition-colors text-sm font-medium shadow-sm">
      Tentar Novamente
    </button>
  </MagicCard>
);
