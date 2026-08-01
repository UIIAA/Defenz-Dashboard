// feature-migracao-neon (Fase 1) — carga histórica Sheets → /api/ingest.
//
// POR QUE EXISTE: o workflow reescreve `deals` inteiro a cada execução (auto-backfill),
// mas `ligacoes`, `emails`, `classificacao_ia` e `resumo_diario` são ACUMULATIVOS — o
// histórico não vem de graça. Este script lê as abas e manda em lotes de 500.
//
// Idempotente: a rota faz upsert pela chave natural. Pode rodar quantas vezes precisar.
//
// Uso:
//   node scripts/backfill-neon.mjs                          # tudo, contra localhost:3000
//   node scripts/backfill-neon.mjs --url https://SEU.app     # contra produção
//   node scripts/backfill-neon.mjs --tabela ligacoes
//   node scripts/backfill-neon.mjs --dry                     # só conta, não envia
//
// ORDEM IMPORTA: `leads` antes de `classificacao_ia`/`agenda` — essas duas têm FK
// pra leads e a rota REJEITA (reportando) a linha cujo lead ainda não existe.

try {
  process.loadEnvFile('.env.local');
} catch {
  /* env pode já estar no ambiente */
}

const SPREADSHEET_ID = '1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ';
const LOTE = 500;

// Assinatura de cada aba — gviz devolve a sheet-0 EM SILÊNCIO quando a aba pedida não
// existe (foi assim que 11,5k ligações viraram reunião em 28/07). Sem conferir a
// assinatura, um erro de nome de aba viraria backfill de dado errado.
const ABAS = [
  ['leads', 'leads', ['lead_id']],
  ['deals', 'deals', ['id', 'stage']],
  ['ligacoes', 'ligacoes', ['call_id', 'data']],
  ['emails', 'emails', ['email_id', 'data']],
  ['classificacao_ia', 'classificacao_ia', ['lead_id', 'data_classificacao']],
  ['agenda', 'agenda', ['task_id']],
  ['resumo_diario', 'resumo_diario', ['data', 'atualizado_em']],
];

const args = process.argv.slice(2);
const opt = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};
const baseUrl = opt('url', 'http://localhost:3000').replace(/\/$/, '');
const soTabela = opt('tabela', null);
const dry = args.includes('--dry');

const token = process.env.INGEST_TOKEN;
if (!token && !dry) {
  console.error('INGEST_TOKEN não definida (.env.local). Use --dry pra só contar.');
  process.exit(1);
}

// Espelho reduzido de src/lib/sheets.ts (aquele é TS e não dá pra importar daqui).
// Se o parser de lá mudar, mude aqui também.
function gvizDateToISO(v) {
  // 1899-12-30 é a época do Sheets: coluna `timeofday` chega como Date(1899,11,30,H,M,S).
  // Truncar pra data destrói a hora em silêncio (ver src/lib/sheets.ts).
  const hora = v.match(/^Date\(1899,11,30,(\d+),(\d+),(\d+)\)/);
  if (hora) {
    const p = (s) => s.padStart(2, '0');
    return `${p(hora[1])}:${p(hora[2])}:${p(hora[3])}`;
  }
  const m = v.match(/^Date\((\d+),(\d+),(\d+)/);
  if (!m) return v;
  return `${m[1]}-${String(Number(m[2]) + 1).padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

async function lerAba(aba, assinatura) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(aba)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`gviz HTTP ${res.status}`);
  const texto = await res.text();
  const m = texto.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
  if (!m) throw new Error('resposta gviz ilegível');
  const json = JSON.parse(m[1]);
  if (json.status === 'error') throw new Error('gviz status=error');

  const headers = (json.table?.cols || []).map((c) => (c.label || c.id || '').trim());
  const faltando = assinatura.filter((c) => !headers.includes(c));
  if (faltando.length) {
    throw new Error(
      `aba '${aba}' sem as colunas ${faltando.join('/')} — gviz provavelmente devolveu a sheet-0`
    );
  }

  return (json.table?.rows || []).map((row) => {
    const obj = {};
    row.c?.forEach((cell, i) => {
      const h = headers[i];
      if (!h) return;
      let v = cell?.v ?? null;
      if (typeof v === 'string' && v.startsWith('Date(')) v = gvizDateToISO(v);
      obj[h] = v;
    });
    return obj;
  });
}

async function enviar(tabela, linhas, lote) {
  const res = await fetch(`${baseUrl}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ingest-Token': token },
    body: JSON.stringify({ tabela, execucao: `backfill#${lote}`, linhas }),
  });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${corpo.error ?? ''} ${corpo.detalhe ?? ''}`);
  return corpo;
}

async function backfill([tabela, aba, assinatura]) {
  process.stdout.write(`\n${tabela.padEnd(18)} lendo '${aba}'… `);
  const linhas = await lerAba(aba, assinatura);
  console.log(`${linhas.length} linhas`);
  if (dry) return;

  const total = { inseridos: 0, atualizados: 0, rejeitados: 0, duplicados: 0, orfaos: 0 };
  const amostraErros = [];

  for (let i = 0; i < linhas.length; i += LOTE) {
    const fatia = linhas.slice(i, i + LOTE);
    const r = await enviar(tabela, fatia, i / LOTE + 1);
    total.inseridos += r.inseridos;
    total.atualizados += r.atualizados;
    total.rejeitados += r.rejeitados;
    total.duplicados += r.duplicados;
    total.orfaos += r.orfaos ?? 0;
    if (amostraErros.length < 5 && r.erros?.length) amostraErros.push(...r.erros.slice(0, 3));
    process.stdout.write(
      `\r  lote ${Math.floor(i / LOTE) + 1}/${Math.ceil(linhas.length / LOTE)} ` +
        `— ins ${total.inseridos} · upd ${total.atualizados} · rej ${total.rejeitados}   `
    );
  }

  console.log(
    `\n  ✓ ${tabela}: ${total.inseridos} inseridos, ${total.atualizados} atualizados, ` +
      `${total.rejeitados} rejeitados, ${total.duplicados} duplicados, ${total.orfaos} orfaos`
  );
  for (const e of amostraErros.slice(0, 5)) {
    console.log(`    ! linha ${e.linha} · ${e.campo}: ${e.motivo}`);
  }
}

const alvo = soTabela ? ABAS.filter(([t]) => t === soTabela) : ABAS;
if (!alvo.length) {
  console.error(`tabela desconhecida: ${soTabela}`);
  console.error(`use uma de: ${ABAS.map(([t]) => t).join(', ')}`);
  process.exit(1);
}

console.log(`backfill → ${baseUrl}${dry ? ' (dry-run)' : ''}`);
for (const entrada of alvo) {
  try {
    await backfill(entrada);
  } catch (e) {
    console.error(`\n  ✗ ${entrada[0]}: ${e.message}`);
    process.exitCode = 1;
  }
}
