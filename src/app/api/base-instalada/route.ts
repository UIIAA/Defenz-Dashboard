import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { fetchFromSheets } from '@/lib/sheets';
import { aggregateBaseInstalada } from '@/lib/base-instalada';
import type { RawDeal } from '@/lib/types';

// NOTE: verifySession protects this APP ROUTE only — same confidentiality note as
// /api/metas: the underlying sheet is a public gviz doc.

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const deals = (await fetchFromSheets('deals')) as RawDeal[];
    return NextResponse.json(aggregateBaseInstalada(deals));
  } catch (error) {
    console.error('Error in base-instalada route:', error);
    return NextResponse.json(
      { error: 'Erro ao agregar base instalada' },
      { status: 500 }
    );
  }
}
