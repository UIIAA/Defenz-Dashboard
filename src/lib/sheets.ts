// Shared Google Sheets fetch utility
// Extracted from duplicated code in 4 API routes

export const SPREADSHEET_ID = "1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ";

export async function fetchFromSheets(sheetName: string): Promise<any[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      console.error(`Sheets fetch failed: ${response.status}`);
      return [];
    }

    const text = await response.text();

    // Google returns JSON with a prefix that needs to be removed
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
    if (!jsonMatch) {
      console.error("Could not parse Sheets response");
      return [];
    }

    const json = JSON.parse(jsonMatch[1]);
    const rows = json.table?.rows || [];
    const cols = json.table?.cols || [];

    const headers = cols.map((col: any) => (col.label || col.id).trim());

    return rows.map((row: any) => {
      const obj: any = {};
      row.c?.forEach((cell: any, i: number) => {
        const header = headers[i];
        if (header) {
          let value = cell?.v ?? null;
          // Google Sheets gviz returns dates as "Date(year,month,day)" (month 0-indexed)
          if (typeof value === 'string' && value.startsWith('Date(')) {
            const match = value.match(/Date\((\d+),(\d+),(\d+)\)/);
            if (match) {
              const year = match[1];
              const month = String(Number(match[2]) + 1).padStart(2, '0');
              const day = match[3].padStart(2, '0');
              value = `${year}-${month}-${day}`;
            }
          }
          obj[header] = value;
        }
      });
      return obj;
    });
  } catch (error) {
    console.error("Error fetching from Sheets:", error);
    return [];
  }
}
