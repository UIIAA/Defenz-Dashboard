#!/usr/bin/env node
// Mantém o corpo do `Format Deals Raw` do n8n igual ao do repo.
//
// POR QUE ISTO EXISTE: o código que decide a comissão da Defenz vivia só dentro do n8n — fora
// do git, sem revisão, sem teste. E vivia em DUAS cópias que alguém tinha que lembrar de editar
// juntas. O sub-workflow acabou com a segunda cópia; este script acaba com a invisibilidade.
//
//     node scripts/sync-n8n-code.mjs            confere (padrão) e falha se divergiu
//     node scripts/sync-n8n-code.mjs --check    idem
//     node scripts/sync-n8n-code.mjs --push     sobe o repo para o n8n
//     node scripts/sync-n8n-code.mjs --print    só imprime o corpo que seria enviado
//
// Credenciais em `.env.local`: N8N_API_URL e N8N_API_KEY.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// O sub-workflow chamado por QjnzGicZHIPBNN1g (coleta) e WlTnk2bHWYhibwyG (refresh).
const WORKFLOW_ID = process.env.N8N_SUB_FORMAT_DEALS_ID || 'pDwyWZau5DwJm6L3';
const NO = 'Format Deals Raw';
const FONTE = 'n8n/format-deals-raw.mjs';

// O bloco de export existe só para o teste local importar as funções; o n8n não aceita `export`.
const MARCA = '/* === daqui para baixo é só para o teste local';

const CAUDA = [
  '',
  '// ---- cauda do n8n, colocada por scripts/sync-n8n-code.mjs (não editar no n8n) ----',
  'const linhas = formatarDeals($input.all());',
  'console.log(`Format Deals Raw: ${linhas.length} deals, ${linhas.filter(d => d.temperatura).length} com temperatura`);',
  'return linhas.map(d => ({ json: d }));',
  '',
].join('\n');

function corpoDoRepo() {
  const src = readFileSync(resolve(RAIZ, FONTE), 'utf8');
  const i = src.indexOf(MARCA);
  if (i === -1) throw new Error(`marcador do bloco de teste não achado em ${FONTE} — o corte é literal, não regex`);
  return `${src.slice(0, i).trimEnd()}\n${CAUDA}`;
}

function env() {
  const vars = { ...process.env };
  try {
    for (const linha of readFileSync(resolve(RAIZ, '.env.local'), 'utf8').split('\n')) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !vars[m[1]]) vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* .env.local é opcional se as vars já estiverem no ambiente */ }
  const url = vars.N8N_API_URL;
  const key = vars.N8N_API_KEY;
  if (!url || !key) {
    console.error('Faltam N8N_API_URL e/ou N8N_API_KEY (no ambiente ou em .env.local).');
    process.exit(2);
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function buscarWorkflow({ url, key }) {
  const r = await fetch(`${url}/api/v1/workflows/${WORKFLOW_ID}`, { headers: { 'X-N8N-API-KEY': key } });
  if (!r.ok) throw new Error(`GET workflow ${WORKFLOW_ID}: HTTP ${r.status}`);
  return r.json();
}

const modo = process.argv[2] || '--check';

if (modo === '--print') {
  process.stdout.write(corpoDoRepo());
  process.exit(0);
}

const cfg = env();
const wf = await buscarWorkflow(cfg);
const no = wf.nodes.find((n) => n.name === NO);
if (!no) {
  console.error(`nó "${NO}" não existe no workflow ${WORKFLOW_ID} (${wf.name}).`);
  process.exit(2);
}

const repo = corpoDoRepo();
const producao = no.parameters.jsCode ?? '';

if (modo === '--check') {
  if (repo === producao) {
    console.log(`OK — ${FONTE} bate com o nó "${NO}" do workflow ${WORKFLOW_ID}.`);
    process.exit(0);
  }
  console.error(`DIVERGIU — ${FONTE} != nó "${NO}" do workflow ${WORKFLOW_ID} (${wf.name}).`);
  console.error(`  repo: ${repo.length} chars | n8n: ${producao.length} chars`);
  const a = repo.split('\n');
  const b = producao.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.error(`  primeira linha diferente (${i + 1}):`);
      console.error(`    repo: ${JSON.stringify(a[i] ?? '(fim)')}`);
      console.error(`    n8n : ${JSON.stringify(b[i] ?? '(fim)')}`);
      break;
    }
  }
  console.error('\n  `--push` sobe o repo para o n8n. Se o certo for o que está no n8n,');
  console.error('  traga a mudança para o repo À MÃO e rode os testes — nunca o contrário.');
  process.exit(1);
}

if (modo === '--push') {
  if (repo === producao) {
    console.log('nada a fazer — já estão iguais.');
    process.exit(0);
  }
  no.parameters.jsCode = repo;
  // A API do n8n recusa campos read-only no PUT; manda só o que ela aceita.
  const corpo = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings ?? {} };
  const r = await fetch(`${cfg.url}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': cfg.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) {
    console.error(`PUT falhou: HTTP ${r.status} ${await r.text()}`);
    process.exit(1);
  }
  console.log(`subiu ${repo.length} chars para o nó "${NO}" do workflow ${WORKFLOW_ID}.`);
  process.exit(0);
}

console.error(`modo desconhecido: ${modo}`);
process.exit(2);
