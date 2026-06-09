// Shared Google Sheets fetch utility
// Extracted from duplicated code in 4 API routes

export const SPREADSHEET_ID = "1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ";

// gviz returns dates as "Date(year,month,day)" OR datetimes as
// "Date(year,month,day,hour,minute,second)" (month is 0-indexed in both).
// We truncate BOTH forms to YYYY-MM-DD. The 3-arg-only form used to silently
// keep datetime cells as raw "Date(...)" strings, which downstream DATE_RE
// checks then dropped (root cause flavor of P9). Matching the leading 3 groups
// without requiring the closing paren handles both.
function gvizDateToISO(value: string): string {
  const match = value.match(/^Date\((\d+),(\d+),(\d+)/);
  if (!match) return value;
  const year = match[1];
  const month = String(Number(match[2]) + 1).padStart(2, '0');
  const day = match[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface GvizParsed {
  headers: string[];
  rows: any[];
}

// Parses a gviz response into headers + row objects.
// Returns null when gviz reports an error (status === 'error') or the body is
// unparseable. NOTE: gviz silently returns sheet 0 for a NON-EXISTENT named
// sheet (HTTP 200, status ok) — so a null here does NOT mean "tab missing".
// Use the returned `headers` (or fetchTabStrict) to detect that case.
function parseGviz(text: string): GvizParsed | null {
  const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
  if (!jsonMatch) return null;

  let json: any;
  try {
    json = JSON.parse(jsonMatch[1]);
  } catch {
    return null;
  }

  if (json.status === 'error') return null;

  const rawRows = json.table?.rows || [];
  const cols = json.table?.cols || [];
  const headers: string[] = cols.map((col: any) => (col.label || col.id || '').trim());

  const rows = rawRows.map((row: any) => {
    const obj: any = {};
    row.c?.forEach((cell: any, i: number) => {
      const header = headers[i];
      if (header) {
        let value = cell?.v ?? null;
        if (typeof value === 'string' && value.startsWith('Date(')) {
          value = gvizDateToISO(value);
        }
        obj[header] = value;
      }
    });
    return obj;
  });

  return { headers, rows };
}

function parseGvizRows(text: string): any[] | null {
  const parsed = parseGviz(text);
  return parsed ? parsed.rows : null;
}

function buildUrl(sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;
}

export async function fetchFromSheets(sheetName: string): Promise<any[]> {
  try {
    const response = await fetch(buildUrl(sheetName), { cache: 'no-store' });

    if (!response.ok) {
      console.error(`Sheets fetch failed: ${response.status}`);
      return [];
    }

    const text = await response.text();
    const rows = parseGvizRows(text);
    if (rows === null) {
      console.error("Could not parse Sheets response");
      return [];
    }
    return rows;
  } catch (error) {
    console.error("Error fetching from Sheets:", error);
    return [];
  }
}

// Returns null when the tab doesn't exist (gviz status=error) or on network error.
// WARNING: gviz returns sheet 0 (HTTP 200) for a non-existent NAMED sheet, so this
// can return sheet-0 rows for a tab that doesn't exist. Prefer fetchTabStrict when
// the tab has a known signature column to detect that case reliably.
export async function fetchFromSheetsNullable(sheetName: string): Promise<any[] | null> {
  try {
    const response = await fetch(buildUrl(sheetName), { cache: 'no-store' });
    if (!response.ok) return null;

    const text = await response.text();
    return parseGvizRows(text); // null if tab not found
  } catch (error) {
    console.error(`Error fetching sheet '${sheetName}':`, error);
    return null;
  }
}

// Strict tab fetch: returns rows ONLY when the returned header set includes every
// column in `signatureColumns`. Otherwise returns null. This defeats the gviz
// "non-existent tab silently returns sheet 0" gotcha: a request for a not-yet-created
// tab comes back as the first sheet (e.g. `ligacoes`) whose headers won't contain the
// expected signature, so we correctly treat it as "tab absent" and return null.
export async function fetchTabStrict(
  sheetName: string,
  signatureColumns: string[]
): Promise<any[] | null> {
  try {
    const response = await fetch(buildUrl(sheetName), { cache: 'no-store' });
    if (!response.ok) return null;

    const parsed = parseGviz(await response.text());
    if (!parsed) return null;

    const headerSet = new Set(parsed.headers);
    const hasSignature = signatureColumns.every(c => headerSet.has(c));
    if (!hasSignature) return null; // tab absent or wrong sheet (gviz sheet-0 fallback)

    return parsed.rows;
  } catch (error) {
    console.error(`Error fetching sheet '${sheetName}' (strict):`, error);
    return null;
  }
}
