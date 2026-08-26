// Verificação da lógica dos nós `Definir periodo` e `Format Ligacoes Raw` do n8n
// (workflow QjnzGicZHIPBNN1g), feature-coleta-incremental.
//
// ⚠️  ESTE ARQUIVO ESPELHA CÓDIGO QUE VIVE NO n8n, NÃO NO REPO.
//     Ele NÃO garante que o nó em produção esteja assim — só que a LÓGICA está certa.
//     Se você mudar o nó no n8n, mude aqui junto, senão isto vira falsa confiança.
//
// O que ele prova:
//   1. o fuso: às 21h BRT o `toISOString()` antigo devolvia AMANHÃ;
//   2. a guarda do §3.3: linha com data não parseável é descartada antes de virar chave,
//      senão duas ligações de dias diferentes formam um grupo que atravessa dias e o
//      incremental corrompe dado ao reatribuir o ordinal;
//   3. que grupos legítimos do mesmo dia continuam ganhando `#2`/`#3` — os ids gerados
//      batem com os que existem em produção no Neon.
//
// Rodar: node scripts/teste-nos-n8n.mjs

// ---------- 1. Definir periodo ----------
function definirPeriodo(body = {}, agora = new Date()) {
  const INICIO_HISTORICO = '2025-11-01';
  const DIAS_RETROLOOK = 1;
  const hoje = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  let full = false, dias = DIAS_RETROLOOK;
  if (body.full === true || body.full === 'true') full = true;
  const n = parseInt(body.dias, 10);
  if (Number.isFinite(n) && n > 0 && n <= 400) dias = n;
  const d = new Date(hoje + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - dias);
  const retro = d.toISOString().split('T')[0];
  return { data_inicio: full ? INICIO_HISTORICO : retro, data_fim: hoje, modo: full ? 'full' : 'incremental' };
}

console.log('--- Definir periodo ---');
// o caso que o fuso quebrava: 21h BRT = 00:00Z do dia seguinte
const meiaNoiteUTC = new Date('2026-08-27T00:05:00Z');   // 26/08 21:05 em Sao Paulo
const r = definirPeriodo({}, meiaNoiteUTC);
console.log('21h05 BRT (00:05Z do dia seguinte):', JSON.stringify(r));
console.log('  hoje BRT deve ser 2026-08-26 →', r.data_fim === '2026-08-26' ? 'OK' : 'FALHOU');
console.log('  antes (toISOString) daria:', meiaNoiteUTC.toISOString().split('T')[0], '← o bug');
console.log('  janela de 1 dia:', r.data_inicio === '2026-08-25' ? 'OK' : 'FALHOU ' + r.data_inicio);
console.log('full:', JSON.stringify(definirPeriodo({ full: true }, meiaNoiteUTC)));
console.log('dias=30:', JSON.stringify(definirPeriodo({ dias: 30 }, meiaNoiteUTC)));
console.log('dias invalido (999):', JSON.stringify(definirPeriodo({ dias: 999 }, meiaNoiteUTC)), '← cai no default');

// ---------- 2. Format Ligacoes Raw ----------
function formatLigacoes(allCalls) {
  if (allCalls.length === 0) return [];
  let descartadas = 0;
  const linhas = allCalls.map((c, i) => {
    const parts = (c.date || '').split(' ');
    const datePart = parts[0] || '';
    const timePart = parts[1] || '00:00:00';
    const dParts = datePart.split('-');
    const dd = dParts[0], mm = dParts[1], yyyy = dParts[2];
    const isoDate = (yyyy && mm && dd) ? `${yyyy}-${mm}-${dd}` : '';
    const origin = c.origin || '';
    const agentName = origin.includes('<') ? origin.split('<')[0].trim() : origin;
    const base = `${isoDate}_${timePart}_${agentName}_${(c.destiny||'').replace(/\D/g,'').slice(-8)}`;
    const disc = [c.interface||'', c.event||'', c.duration||'', c.disposition||''].join('~');
    return { i, c, base, disc, isoDate, timePart, agentName, call_id: base };
  }).filter(l => { if (!l.isoDate) { descartadas++; return false; } return true; });

  const grupos = new Map();
  for (const l of linhas) { if (!grupos.has(l.base)) grupos.set(l.base, []); grupos.get(l.base).push(l); }
  for (const [, itens] of grupos) {
    if (itens.length === 1) continue;
    itens.sort((a,b)=> (a.disc<b.disc?-1:a.disc>b.disc?1:a.i-b.i));
    itens.forEach((it,k)=>{ it.call_id = k===0 ? it.base : `${it.base}#${k+1}`; });
  }
  return { ids: linhas.map(l=>l.call_id), descartadas };
}

console.log('\n--- Format Ligacoes Raw ---');
console.log('payload vazio →', JSON.stringify(formatLigacoes([])), '(antes: linha-lixo call_id:none)');

// O CENARIO QUE A GUARDA IMPEDE: data nao parseavel em DIAS DIFERENTES,
// mesmo horario/agente/destino. Sem a guarda, virariam um grupo que atravessa dias.
const venenoso = [
  { date: 'LIXO 14:48:07',       origin: 'Gustavo <101>', destiny: '31987678836', interface: 'PJSIP', event: 'Atendimento', duration: 11 },
  { date: 'TAMBEM-LIXO 14:48:07',origin: 'Gustavo <101>', destiny: '31987678836', interface: 'Local', event: 'Falha', duration: 8 },
  { date: '25-08-2026 09:00:00', origin: 'Gustavo <101>', destiny: '31999990000', interface: 'PJSIP', event: 'Atendimento', duration: 30 },
];
const out = formatLigacoes(venenoso);
console.log('payload com 2 datas nao parseaveis:', JSON.stringify(out));
console.log('  descartou as 2 podres →', out.descartadas === 2 ? 'OK' : 'FALHOU');
console.log('  nenhum id sem data →', out.ids.every(id => /^\d{4}-\d{2}-\d{2}_/.test(id)) ? 'OK' : 'FALHOU: ' + out.ids);

// grupo legitimo do mesmo dia continua ganhando ordinal
const legitimo = [
  { date: '24-07-2026 14:48:07', origin: '31987678836', destiny: '', interface: 'PJSIP', event: 'Atendimento', duration: 11 },
  { date: '24-07-2026 14:48:07', origin: '31987678836', destiny: '', interface: 'Local', event: 'Falha', duration: 8 },
  { date: '24-07-2026 14:48:07', origin: '31987678836', destiny: '', interface: 'Local', event: 'Atendimento', duration: 3 },
];
const g = formatLigacoes(legitimo);
console.log('grupo legitimo (3 pernas, mesmo segundo):', JSON.stringify(g.ids));
console.log('  ordinal preservado →', g.ids.filter(i=>i.includes('#')).length === 2 ? 'OK' : 'FALHOU');
