import type { Temperatura } from '@/lib/oportunidades';

const CORES: Record<Temperatura, { bg: string; borda: string; nome: string }> = {
  quente: { bg: 'bg-red-500', borda: 'border-red-500', nome: 'Quente' },
  morno: { bg: 'bg-amber-400', borda: 'border-amber-400', nome: 'Morno' },
  frio: { bg: 'bg-blue-500', borda: 'border-blue-500', nome: 'Frio' },
};

interface Props {
  temperatura: Temperatura | '';
  /** Levemente maior nos chips do filtro. */
  size?: 'sm' | 'md';
}

/**
 * Bolinha do semáforo — feature-semaforo-oportunidades §5.5.
 *
 * A cor NÃO pode ser o único portador da informação: vermelho × âmbar é a colisão
 * protan/deutan clássica (viram o mesmo marrom-amarelado), e nesta mesma tela o vermelho já
 * carrega outro sentido em outros lugares do produto ("vermelho só para problema real").
 * Por isso todo ponto leva `title` e `aria-label` com o nome escrito.
 */
export const SemaforoDot = ({ temperatura, size = 'sm' }: Props) => {
  const dim = size === 'md' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const c = temperatura ? CORES[temperatura] : null;
  const nome = c ? c.nome : 'Sem classificação';

  return (
    <span
      role="img"
      aria-label={nome}
      title={nome}
      className={`shrink-0 rounded-full border-[1.5px] ${dim} ${
        c ? `${c.bg} ${c.borda}` : 'bg-transparent border-slate-300'
      }`}
    />
  );
};

export const TEMPERATURA_NOME: Record<Temperatura | '', string> = {
  quente: 'Quente',
  morno: 'Morno',
  frio: 'Frio',
  '': 'Sem classificação',
};
