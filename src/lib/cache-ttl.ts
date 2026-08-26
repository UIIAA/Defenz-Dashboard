// TTL de cache — feature-coleta-incremental §3.6.
//
// O valor estava DUPLICADO em 12 arquivos (9 rotas + 2 hooks + cache.ts). Mudar a frequência
// da coleta sem mudar isto não teria efeito nenhum na tela: com 30 min no servidor MAIS 30 min
// no sessionStorage do cliente, o pior caso era ~60 min de atraso mesmo com coleta de hora em
// hora — e a conclusão seria "não funcionou".
//
// Sem dependência de propósito: é importado por rota (servidor) e por hook (cliente).

/**
 * Dados do dia em andamento (resumo diário, metas, operacional, agenda, esforço, ligações).
 * Acompanha a coleta horária: 10 min garante no máximo ~1 ciclo de defasagem.
 * NÃO é zero porque cada miss relê 4,6 MB de gviz da aba `ligacoes`.
 */
export const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Dados de mês fechado (relatório mensal, faturamento mensal). Não mudam de hora em hora,
 * e cada leitura custa o gviz inteiro — manter longo é economia, não descuido.
 */
export const CACHE_TTL_LONGO_MS = 30 * 60 * 1000;
