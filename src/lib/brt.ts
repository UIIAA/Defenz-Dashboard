// Fonte única do "hoje" do dashboard (feature-041 §3.2).
//
// POR QUE ISTO EXISTE: o código usava `new Date().toISOString().split('T')[0]`, que devolve o
// dia em UTC. A partir das 21h de Brasília o dashboard já estava no dia seguinte — `/` e
// `/diario` mostravam semanas diferentes com o mesmo rótulo.
//
// `en-CA` porque é o locale que formata como YYYY-MM-DD.

export function hojeBRT(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
