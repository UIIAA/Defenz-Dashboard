import ExcelJS from 'exceljs';
import type { EnrichedLead, ScorecardKPI } from './types';

// Color constants
const COLORS = {
  headerBg: 'FF1E293B',    // slate-800
  headerFg: 'FFFFFFFF',
  decisor: 'FF22C55E',     // green
  tecnico: 'FF3B82F6',     // blue
  secretaria: 'FFEAB308',  // yellow
  nenhum_contato: 'FFEF4444', // red
  deprecado: 'FF9CA3AF',   // gray
  lightGreen: 'FFF0FDF4',
  lightRed: 'FFFEF2F2',
  lightGray: 'FFF8FAFC',
  border: 'FFE2E8F0',
  ok: 'FF22C55E',
  warning: 'FFEAB308',
  critical: 'FFEF4444',
};

function applyHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.font = { bold: true, color: { argb: COLORS.headerFg }, size: 10 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 28;
  for (let i = 1; i <= colCount; i++) {
    row.getCell(i).border = {
      bottom: { style: 'thin', color: { argb: COLORS.border } },
    };
  }
}

function applyDataRow(row: ExcelJS.Row, colCount: number, isAlt: boolean) {
  if (isAlt) {
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
  }
  row.alignment = { vertical: 'middle', wrapText: false };
  row.font = { size: 9 };
  for (let i = 1; i <= colCount; i++) {
    row.getCell(i).border = {
      bottom: { style: 'hair', color: { argb: COLORS.border } },
    };
  }
}

function getNivelColor(nivel: string): string {
  switch (nivel.toLowerCase()) {
    case 'decisor': return COLORS.decisor;
    case 'tecnico': return COLORS.tecnico;
    case 'secretaria': return COLORS.secretaria;
    case 'nenhum_contato':
    case 'tag_apenas': return COLORS.nenhum_contato;
    case 'deprecado': return COLORS.deprecado;
    default: return COLORS.deprecado;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ok': return COLORS.ok;
    case 'warning': return COLORS.warning;
    case 'critical': return COLORS.critical;
    default: return COLORS.deprecado;
  }
}

// ============================================================
// Aba 1: Classificacao (dados brutos enriquecidos)
// ============================================================
function buildClassificacaoSheet(wb: ExcelJS.Workbook, leads: EnrichedLead[]) {
  const ws = wb.addWorksheet('Classificacao', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const columns = [
    { header: 'Lead ID', key: 'lead_id', width: 20 },
    { header: 'Nome', key: 'nome', width: 30 },
    { header: 'Empresa', key: 'empresa', width: 25 },
    { header: 'Lead Source', key: 'lead_source', width: 18 },
    { header: 'Lead Status', key: 'lead_status', width: 15 },
    { header: 'Nivel Maximo', key: 'nivel_maximo', width: 16 },
    { header: 'Passou Secretaria', key: 'passou_secretaria', width: 18 },
    { header: 'Resultado Principal', key: 'resultado_principal', width: 20 },
    { header: 'Concorrente', key: 'concorrente', width: 18 },
    { header: 'Toques Estimados', key: 'toques_estimados', width: 16 },
    { header: 'Cargo Estimado', key: 'cargo_estimado', width: 18 },
    { header: 'Ligacoes', key: 'total_ligacoes', width: 10 },
    { header: 'Lig. Atendidas', key: 'ligacoes_atendidas', width: 14 },
    { header: 'Emails', key: 'total_emails', width: 10 },
    { header: 'Canal', key: 'canal', width: 14 },
    { header: '1o Contato', key: 'primeiro_contato', width: 12 },
    { header: 'Ultimo Contato', key: 'ultimo_contato', width: 14 },
    { header: 'Resumo', key: 'resumo', width: 50 },
  ];
  ws.columns = columns;

  // Header row
  applyHeaderRow(ws.getRow(1), columns.length);

  // Data rows
  leads.forEach((lead, idx) => {
    const row = ws.addRow({
      lead_id: lead.lead_id,
      nome: lead.nome,
      empresa: lead.empresa,
      lead_source: lead.lead_source,
      lead_status: lead.lead_status,
      nivel_maximo: lead.nivel_maximo,
      passou_secretaria: lead.passou_secretaria ? 'Sim' : 'Nao',
      resultado_principal: lead.resultado_principal,
      concorrente: lead.concorrente || '-',
      toques_estimados: lead.toques_estimados,
      cargo_estimado: lead.cargo_estimado,
      total_ligacoes: lead.total_ligacoes,
      ligacoes_atendidas: lead.ligacoes_atendidas,
      total_emails: lead.total_emails,
      canal: lead.canal,
      primeiro_contato: lead.primeiro_contato || '-',
      ultimo_contato: lead.ultimo_contato || '-',
      resumo: lead.resumo,
    });

    applyDataRow(row, columns.length, idx % 2 === 1);

    // Conditional color on nivel_maximo cell
    const nivelCell = row.getCell('nivel_maximo');
    const color = getNivelColor(lead.nivel_maximo);
    nivelCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    nivelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    nivelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Gray out deprecated rows
    if (lead.is_deprecado) {
      for (let c = 1; c <= columns.length; c++) {
        const cell = row.getCell(c);
        if (c !== 6) { // Skip nivel_maximo (already colored)
          cell.font = { ...cell.font, color: { argb: 'FF9CA3AF' }, size: 9 };
        }
      }
    }
  });

  // Auto filter
  ws.autoFilter = { from: 'A1', to: `R${leads.length + 1}` };
}

// ============================================================
// Aba 2: Dados (funil + distribuicao)
// ============================================================
function buildDadosSheet(wb: ExcelJS.Workbook, leads: EnrichedLead[]) {
  const ws = wb.addWorksheet('Dados');

  const total = leads.length;
  const comResultados = leads.filter(l => !l.is_deprecado).length;
  const contatoEstabelecido = leads.filter(l =>
    !l.is_deprecado && l.nivel_maximo !== 'nenhum_contato' && l.nivel_maximo !== 'tag_apenas'
  ).length;
  const passouSecretaria = leads.filter(l => l.passou_secretaria).length;
  const decisorTecnico = leads.filter(l =>
    l.nivel_maximo === 'decisor' || l.nivel_maximo === 'tecnico'
  ).length;
  const interesseProposta = leads.filter(l =>
    ['interessado', 'agendou_reuniao', 'enviou_proposta', 'em_negociacao'].includes(l.resultado_principal)
  ).length;

  // Set column widths
  ws.getColumn(1).width = 25;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 10;
  ws.getColumn(4).width = 3; // spacer
  ws.getColumn(5).width = 25;
  ws.getColumn(6).width = 10;
  ws.getColumn(7).width = 10;
  ws.getColumn(8).width = 3;
  ws.getColumn(9).width = 25;
  ws.getColumn(10).width = 10;
  ws.getColumn(11).width = 15;
  ws.getColumn(12).width = 3;
  ws.getColumn(13).width = 20;
  ws.getColumn(14).width = 10;
  ws.getColumn(15).width = 10;

  const bold = { bold: true, size: 11 as number };
  const headerStyle: Partial<ExcelJS.Font> = { bold: true, color: { argb: COLORS.headerFg }, size: 10 };
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };

  // SECTION: Funil (A1:C8)
  let r = 1;
  const funnelHeader = ws.getRow(r);
  ['Funil de Esforco', 'Qtd', '%'].forEach((h, i) => {
    const cell = funnelHeader.getCell(i + 1);
    cell.value = h;
    cell.font = headerStyle;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  r++;

  const funnelData = [
    ['Leads Total', total, '100%'],
    ['Com Resultados', comResultados, total > 0 ? `${Math.round((comResultados / total) * 100)}%` : '0%'],
    ['Contato Estabelecido', contatoEstabelecido, total > 0 ? `${Math.round((contatoEstabelecido / total) * 100)}%` : '0%'],
    ['Passou Secretaria', passouSecretaria, total > 0 ? `${Math.round((passouSecretaria / total) * 100)}%` : '0%'],
    ['Decisor/Tecnico', decisorTecnico, total > 0 ? `${Math.round((decisorTecnico / total) * 100)}%` : '0%'],
    ['Interesse/Proposta', interesseProposta, total > 0 ? `${Math.round((interesseProposta / total) * 100)}%` : '0%'],
  ];
  funnelData.forEach((data, idx) => {
    const row = ws.getRow(r + idx);
    row.getCell(1).value = data[0];
    row.getCell(1).font = { size: 10 };
    row.getCell(2).value = data[1];
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).value = data[2];
    row.getCell(3).alignment = { horizontal: 'center' };
    if (idx % 2 === 1) {
      [1, 2, 3].forEach(c => {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
      });
    }
  });

  // SECTION: Distribuicao por Resultado (E1:G)
  r = 1;
  const respostaCounts: Record<string, number> = {};
  leads.filter(l => !l.is_deprecado).forEach(l => {
    const key = l.resultado_principal || 'inconclusivo';
    respostaCounts[key] = (respostaCounts[key] || 0) + 1;
  });
  const respostas = Object.entries(respostaCounts).sort((a, b) => b[1] - a[1]);

  const resHeader = ws.getRow(r);
  ['Resultado', 'Qtd', '%'].forEach((h, i) => {
    const cell = resHeader.getCell(i + 5);
    cell.value = h;
    cell.font = headerStyle;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  r = 2;
  respostas.forEach(([key, count], idx) => {
    const row = ws.getRow(r + idx);
    row.getCell(5).value = key;
    row.getCell(5).font = { size: 10 };
    row.getCell(6).value = count;
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).value = comResultados > 0 ? `${Math.round((count / comResultados) * 100)}%` : '0%';
    row.getCell(7).alignment = { horizontal: 'center' };
  });

  // SECTION: Concorrentes (I1:K)
  r = 1;
  const concorrenteMap: Record<string, { deals: number; renovacao: string }> = {};
  leads.forEach(l => {
    if (!l.concorrente) return;
    if (!concorrenteMap[l.concorrente]) concorrenteMap[l.concorrente] = { deals: 0, renovacao: '' };
    concorrenteMap[l.concorrente].deals++;
  });
  const concorrentes = Object.entries(concorrenteMap).sort((a, b) => b[1].deals - a[1].deals);

  const concHeader = ws.getRow(r);
  ['Concorrente', 'Leads', 'Renovacao'].forEach((h, i) => {
    const cell = concHeader.getCell(i + 9);
    cell.value = h;
    cell.font = headerStyle;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  r = 2;
  concorrentes.forEach(([nome, info], idx) => {
    const row = ws.getRow(r + idx);
    row.getCell(9).value = nome;
    row.getCell(9).font = { size: 10 };
    row.getCell(10).value = info.deals;
    row.getCell(10).alignment = { horizontal: 'center' };
    row.getCell(11).value = info.renovacao || '-';
    row.getCell(11).alignment = { horizontal: 'center' };
  });

  // SECTION: Cobertura por Canal (M1:O)
  r = 1;
  const ligOnly = leads.filter(l => l.canal === 'ligacoes_only').length;
  const emailOnly = leads.filter(l => l.canal === 'emails_only').length;
  const ambos = leads.filter(l => l.canal === 'ambos').length;
  const nenhum = leads.filter(l => l.canal === 'nenhum').length;

  const canalHeader = ws.getRow(r);
  ['Canal', 'Qtd', '%'].forEach((h, i) => {
    const cell = canalHeader.getCell(i + 13);
    cell.value = h;
    cell.font = headerStyle;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  r = 2;
  const canalData = [
    ['Ligacoes only', ligOnly],
    ['Emails only', emailOnly],
    ['Ambos', ambos],
    ['Nenhum', nenhum],
  ];
  canalData.forEach(([label, count], idx) => {
    const row = ws.getRow(r + idx);
    row.getCell(13).value = label;
    row.getCell(13).font = { size: 10 };
    row.getCell(14).value = count;
    row.getCell(14).alignment = { horizontal: 'center' };
    row.getCell(15).value = total > 0 ? `${Math.round(((count as number) / total) * 100)}%` : '0%';
    row.getCell(15).alignment = { horizontal: 'center' };
  });
}

// ============================================================
// Aba 3: Scorecard (KPIs com benchmarks)
// ============================================================
function buildScorecardSheet(wb: ExcelJS.Workbook, kpis: ScorecardKPI[]) {
  const ws = wb.addWorksheet('Scorecard', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: 'KPI', key: 'metrica', width: 35 },
    { header: 'Valor', key: 'valor', width: 15 },
    { header: 'Benchmark', key: 'benchmark', width: 15 },
    { header: 'Gap', key: 'gap', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
  ];

  applyHeaderRow(ws.getRow(1), 5);

  kpis.forEach((kpi, idx) => {
    const row = ws.addRow({
      metrica: kpi.metrica,
      valor: kpi.valor,
      benchmark: kpi.benchmark,
      gap: kpi.gap,
      status: kpi.status === 'ok' ? 'OK' : kpi.status === 'warning' ? 'ATENCAO' : 'CRITICO',
    });

    applyDataRow(row, 5, idx % 2 === 1);

    // Status cell color
    const statusCell = row.getCell('status');
    const color = getStatusColor(kpi.status);
    statusCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
}

// ============================================================
// Aba 4: Matriz (cross-tab nivel x resultado)
// ============================================================
function buildMatrizSheet(wb: ExcelJS.Workbook, leads: EnrichedLead[]) {
  const ws = wb.addWorksheet('Matriz');

  const niveis = ['decisor', 'tecnico', 'secretaria', 'nenhum_contato', 'DEPRECADO'];
  const resultados = ['interessado', 'em_negociacao', 'tem_concorrente', 'nao_agora', 'recusou', 'sem_resposta', 'inconclusivo', 'DEPRECADO'];

  // Build count matrix
  const matrix: Record<string, Record<string, number>> = {};
  for (const n of niveis) {
    matrix[n] = {};
    for (const r of resultados) matrix[n][r] = 0;
  }
  leads.forEach(l => {
    const nivel = niveis.includes(l.nivel_maximo) ? l.nivel_maximo : 'DEPRECADO';
    const resultado = resultados.includes(l.resultado_principal) ? l.resultado_principal : 'inconclusivo';
    matrix[nivel][resultado]++;
  });

  // Column widths
  ws.getColumn(1).width = 18;
  for (let i = 0; i < resultados.length; i++) ws.getColumn(i + 2).width = 16;
  ws.getColumn(resultados.length + 2).width = 10;

  const headerStyle: Partial<ExcelJS.Font> = { bold: true, color: { argb: COLORS.headerFg }, size: 10 };
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };

  // Header row
  const headerRow = ws.getRow(1);
  headerRow.getCell(1).value = 'Nivel \\ Resultado';
  headerRow.getCell(1).font = headerStyle;
  headerRow.getCell(1).fill = headerFill;
  resultados.forEach((r, i) => {
    const cell = headerRow.getCell(i + 2);
    cell.value = r;
    cell.font = headerStyle;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  const totalColHeader = headerRow.getCell(resultados.length + 2);
  totalColHeader.value = 'TOTAL';
  totalColHeader.font = headerStyle;
  totalColHeader.fill = headerFill;
  totalColHeader.alignment = { horizontal: 'center' };

  // Data rows
  niveis.forEach((nivel, nIdx) => {
    const row = ws.getRow(nIdx + 2);
    row.getCell(1).value = nivel;
    row.getCell(1).font = { bold: true, size: 10 };

    let rowTotal = 0;
    resultados.forEach((resultado, rIdx) => {
      const count = matrix[nivel][resultado];
      rowTotal += count;
      const cell = row.getCell(rIdx + 2);
      cell.value = count;
      cell.alignment = { horizontal: 'center' };

      // Color cells with values > 0
      if (count > 0) {
        cell.font = { bold: true, size: 10 };
        cell.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: count >= 10 ? 'FFDBEAFE' : 'FFF1F5F9' },
        };
      }
    });

    const totalCell = row.getCell(resultados.length + 2);
    totalCell.value = rowTotal;
    totalCell.font = { bold: true, size: 10 };
    totalCell.alignment = { horizontal: 'center' };
  });

  // Totals row
  const totalsRow = ws.getRow(niveis.length + 2);
  totalsRow.getCell(1).value = 'TOTAL';
  totalsRow.getCell(1).font = { bold: true, size: 10 };
  totalsRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };

  let grandTotal = 0;
  resultados.forEach((resultado, rIdx) => {
    let colTotal = 0;
    niveis.forEach(nivel => { colTotal += matrix[nivel][resultado]; });
    grandTotal += colTotal;
    const cell = totalsRow.getCell(rIdx + 2);
    cell.value = colTotal;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
  });
  const grandTotalCell = totalsRow.getCell(resultados.length + 2);
  grandTotalCell.value = grandTotal;
  grandTotalCell.font = { bold: true, size: 11 };
  grandTotalCell.alignment = { horizontal: 'center' };
  grandTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
}

// ============================================================
// Aba 5: Correlacao (analise por canal)
// ============================================================
function buildCorrelacaoSheet(wb: ExcelJS.Workbook, leads: EnrichedLead[]) {
  const ws = wb.addWorksheet('Correlacao');

  const headerStyle: Partial<ExcelJS.Font> = { bold: true, color: { argb: COLORS.headerFg }, size: 10 };
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  const subHeaderFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };

  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 18;
  ws.getColumn(6).width = 18;
  ws.getColumn(7).width = 20;

  // Section 1: Intensidade de Toques
  let r = 1;
  const titleRow1 = ws.getRow(r);
  titleRow1.getCell(1).value = 'INTENSIDADE DE TOQUES';
  titleRow1.getCell(1).font = subHeaderFont;
  r++;

  const headerRow1 = ws.getRow(r);
  ['Metrica', 'Convertidos', 'Nao Convertidos', 'Delta'].forEach((h, i) => {
    const cell = headerRow1.getCell(i + 1);
    cell.value = h;
    cell.font = headerStyle;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  r++;

  // "Converted" = interessado, agendou_reuniao, enviou_proposta, em_negociacao
  const convertedResults = ['interessado', 'agendou_reuniao', 'enviou_proposta', 'em_negociacao'];
  const converted = leads.filter(l => convertedResults.includes(l.resultado_principal));
  const notConverted = leads.filter(l => !l.is_deprecado && !convertedResults.includes(l.resultado_principal));

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0;

  const convLig = avg(converted.map(l => l.total_ligacoes));
  const convEmail = avg(converted.map(l => l.total_emails));
  const convTotal = avg(converted.map(l => l.total_ligacoes + l.total_emails));
  const ncLig = avg(notConverted.map(l => l.total_ligacoes));
  const ncEmail = avg(notConverted.map(l => l.total_emails));
  const ncTotal = avg(notConverted.map(l => l.total_ligacoes + l.total_emails));

  [
    ['Media Ligacoes', convLig, ncLig],
    ['Media Emails', convEmail, ncEmail],
    ['Media Total Toques', convTotal, ncTotal],
  ].forEach(([label, conv, nc], idx) => {
    const row = ws.getRow(r + idx);
    row.getCell(1).value = label;
    row.getCell(1).font = { size: 10 };
    row.getCell(2).value = conv;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).value = nc;
    row.getCell(3).alignment = { horizontal: 'center' };
    const delta = (conv as number) - (nc as number);
    row.getCell(4).value = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(4).font = { size: 10, color: { argb: delta > 0 ? COLORS.ok : COLORS.critical } };
  });
  r += 5;

  // Section 2: Top 20 leads by activity volume
  const titleRow2 = ws.getRow(r);
  titleRow2.getCell(1).value = 'TOP 20 LEADS POR VOLUME DE ATIVIDADE';
  titleRow2.getCell(1).font = subHeaderFont;
  r++;

  const headerRow2 = ws.getRow(r);
  ['Lead', 'Empresa', 'Ligacoes', 'Emails', 'Total', 'Nivel', 'Resultado'].forEach((h, i) => {
    const cell = headerRow2.getCell(i + 1);
    cell.value = h;
    cell.font = headerStyle;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  r++;

  const top20 = [...leads]
    .sort((a, b) => (b.total_ligacoes + b.total_emails) - (a.total_ligacoes + a.total_emails))
    .slice(0, 20);

  top20.forEach((lead, idx) => {
    const row = ws.getRow(r + idx);
    row.getCell(1).value = lead.nome;
    row.getCell(1).font = { size: 9 };
    row.getCell(2).value = lead.empresa;
    row.getCell(2).font = { size: 9 };
    row.getCell(3).value = lead.total_ligacoes;
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).value = lead.total_emails;
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).value = lead.total_ligacoes + lead.total_emails;
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(5).font = { bold: true, size: 9 };
    row.getCell(6).value = lead.nivel_maximo;
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).value = lead.resultado_principal;
    row.getCell(7).alignment = { horizontal: 'center' };
    applyDataRow(row, 7, idx % 2 === 1);
  });
  r += 22;

  // Section 3: Leads without any contact
  const semContato = leads.filter(l => l.canal === 'nenhum' && !l.is_deprecado);
  const titleRow3 = ws.getRow(r);
  titleRow3.getCell(1).value = `LEADS SEM NENHUM CONTATO REGISTRADO (${semContato.length})`;
  titleRow3.getCell(1).font = subHeaderFont;
  r++;

  const headerRow3 = ws.getRow(r);
  ['Lead', 'Empresa', 'Lead Source', 'Lead Status', 'Nivel', 'Resultado'].forEach((h, i) => {
    const cell = headerRow3.getCell(i + 1);
    cell.value = h;
    cell.font = headerStyle;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  r++;

  semContato.slice(0, 50).forEach((lead, idx) => {
    const row = ws.getRow(r + idx);
    row.getCell(1).value = lead.nome;
    row.getCell(1).font = { size: 9 };
    row.getCell(2).value = lead.empresa;
    row.getCell(2).font = { size: 9 };
    row.getCell(3).value = lead.lead_source;
    row.getCell(3).font = { size: 9 };
    row.getCell(4).value = lead.lead_status;
    row.getCell(4).font = { size: 9 };
    row.getCell(5).value = lead.nivel_maximo;
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).value = lead.resultado_principal;
    row.getCell(6).alignment = { horizontal: 'center' };
    applyDataRow(row, 6, idx % 2 === 1);
  });
}

// ============================================================
// KPI calculator
// ============================================================
export function computeKPIs(leads: EnrichedLead[], metricas: any): ScorecardKPI[] {
  const total = leads.length;
  const active = leads.filter(l => !l.is_deprecado);
  const activeCount = active.length;

  const decisorTecnico = active.filter(l =>
    l.nivel_maximo === 'decisor' || l.nivel_maximo === 'tecnico'
  ).length;
  const decisorOnly = active.filter(l => l.nivel_maximo === 'decisor').length;
  const passouSec = active.filter(l => l.passou_secretaria).length;
  const recusou = active.filter(l => l.resultado_principal === 'recusou').length;
  const contactados = leads.filter(l => l.canal !== 'nenhum').length;
  const interesseProposta = active.filter(l =>
    ['interessado', 'agendou_reuniao', 'enviou_proposta', 'em_negociacao'].includes(l.resultado_principal)
  ).length;
  const avgToques = activeCount > 0
    ? Math.round((active.reduce((s, l) => s + l.toques_estimados, 0) / activeCount) * 10) / 10
    : 0;

  const taxaConectividade = Number(metricas?.taxa_conectividade) || 0;
  const ticketMedio = Number(metricas?.ticket_medio) || 0;
  const winRate = Number(metricas?.win_rate) || 0;

  const taxaDT = activeCount > 0 ? Math.round((decisorTecnico / activeCount) * 100) : 0;
  const taxaDecisor = activeCount > 0 ? Math.round((decisorOnly / activeCount) * 100) : 0;
  const taxaCobertura = total > 0 ? Math.round((contactados / total) * 100) : 0;
  const taxaBloqueado = activeCount > 0 ? Math.round(((activeCount - passouSec) / activeCount) * 100) : 0;
  const taxaRecusou = activeCount > 0 ? Math.round((recusou / activeCount) * 100) : 0;
  const pipelineRate = total > 0 ? Math.round((interesseProposta / total) * 100) : 0;

  const classify = (val: number, okMin: number, warnMin: number, invert = false): 'ok' | 'warning' | 'critical' => {
    if (invert) return val <= okMin ? 'ok' : val <= warnMin ? 'warning' : 'critical';
    return val >= okMin ? 'ok' : val >= warnMin ? 'warning' : 'critical';
  };

  return [
    {
      metrica: 'Taxa Acesso Decisor/TI',
      valor: taxaDT,
      benchmark: '30-40%',
      gap: `${taxaDT - 35 >= 0 ? '+' : ''}${taxaDT - 35}pp`,
      status: classify(taxaDT, 30, 20),
    },
    {
      metrica: 'Taxa Acesso DECISOR',
      valor: taxaDecisor,
      benchmark: '10-15%',
      gap: `${taxaDecisor - 12 >= 0 ? '+' : ''}${taxaDecisor - 12}pp`,
      status: classify(taxaDecisor, 10, 5),
    },
    {
      metrica: 'Media Toques/Lead',
      valor: avgToques,
      benchmark: '6-8',
      gap: `${avgToques - 7 >= 0 ? '+' : ''}${(avgToques - 7).toFixed(1)}`,
      status: classify(avgToques, 6, 4),
    },
    {
      metrica: 'Taxa Cobertura (contactados/total)',
      valor: taxaCobertura,
      benchmark: '>80%',
      gap: `${taxaCobertura - 80 >= 0 ? '+' : ''}${taxaCobertura - 80}pp`,
      status: classify(taxaCobertura, 80, 60),
    },
    {
      metrica: 'Taxa Conectividade (calls atendidas)',
      valor: taxaConectividade,
      benchmark: '>30%',
      gap: `${taxaConectividade - 30 >= 0 ? '+' : ''}${taxaConectividade - 30}pp`,
      status: classify(taxaConectividade, 30, 20),
    },
    {
      metrica: '% Bloqueado Secretaria',
      valor: taxaBloqueado,
      benchmark: '<40%',
      gap: `${taxaBloqueado - 40 >= 0 ? '+' : ''}${taxaBloqueado - 40}pp`,
      status: classify(taxaBloqueado, 40, 60, true),
    },
    {
      metrica: '% Recusou',
      valor: taxaRecusou,
      benchmark: '<50%',
      gap: `${taxaRecusou - 50 >= 0 ? '+' : ''}${taxaRecusou - 50}pp`,
      status: classify(taxaRecusou, 50, 70, true),
    },
    {
      metrica: 'Pipeline Rate (interesse/total)',
      valor: pipelineRate,
      benchmark: '>25%',
      gap: `${pipelineRate - 25 >= 0 ? '+' : ''}${pipelineRate - 25}pp`,
      status: classify(pipelineRate, 25, 15),
    },
    {
      metrica: 'Ticket Medio',
      valor: ticketMedio,
      benchmark: 'R$ 50.000',
      gap: ticketMedio >= 50000 ? `+R$ ${(ticketMedio - 50000).toLocaleString('pt-BR')}` : `-R$ ${(50000 - ticketMedio).toLocaleString('pt-BR')}`,
      status: classify(ticketMedio, 50000, 30000),
    },
    {
      metrica: 'Win Rate',
      valor: winRate,
      benchmark: '25%',
      gap: `${winRate - 25 >= 0 ? '+' : ''}${winRate - 25}pp`,
      status: classify(winRate, 25, 15),
    },
  ];
}

// ============================================================
// Main builder
// ============================================================
export async function buildExecutiveExcel(
  leads: EnrichedLead[],
  metricas: any,
  kpis: ScorecardKPI[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Defenz Dashboard';
  wb.created = new Date();

  buildClassificacaoSheet(wb, leads);
  buildDadosSheet(wb, leads);
  buildScorecardSheet(wb, kpis);
  buildMatrizSheet(wb, leads);
  buildCorrelacaoSheet(wb, leads);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
