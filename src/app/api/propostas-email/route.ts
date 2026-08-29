import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  contarPropostas,
  contarPropostasPorRemetente,
  type EmailBruto,
  type PropostasPorRemetente,
} from '@/lib/propostas';

// feature-proposta-email-exchange — "Proposta enviada" medida na caixa do Exchange.
//
// A REGRA NÃO É REESCRITA EM SQL. A query só traz as linhas do dia; quem decide o que é
// proposta e como contar é `src/lib/propostas.ts`, que tem teste. Duplicar a regra em SQL
// criaria um segundo dono da mesma verdade — e é assim que dois números discordam.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PropostasEmailResponse {
  data: string;
  total: number;
  por_remetente: PropostasPorRemetente[];
  /** PDF externo que não casou a regra — sinal de que a convenção de nome mudou */
  quase_propostas: number;
}

export async function GET(request: NextRequest) {
  if (!(await verifySession(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pedida = request.nextUrl.searchParams.get('data');
  const data =
    pedida && DATE_RE.test(pedida)
      ? pedida
      : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  try {
    // Janela pelo dia civil de São Paulo, não pelo dia UTC.
    const sql = db();
    const linhas = (await sql`
      select internet_message_id, caixa, remetente, assunto, enviado_em,
             destinatarios, anexos, motivo_revisao
        from emails_enviados
       where (enviado_em at time zone 'America/Sao_Paulo')::date = ${data}::date
    `) as Array<{
      internet_message_id: string;
      caixa: string;
      remetente: string;
      assunto: string | null;
      enviado_em: Date | string;
      destinatarios: string[] | null;
      anexos: string[] | null;
      motivo_revisao: string | null;
    }>;

    const emails: EmailBruto[] = linhas.map((l) => ({
      internetMessageId: l.internet_message_id,
      caixa: l.caixa,
      remetente: l.remetente,
      assunto: l.assunto ?? '',
      enviadoEm: new Date(l.enviado_em).toISOString(),
      destinatarios: l.destinatarios ?? [],
      anexos: l.anexos ?? [],
    }));

    const body: PropostasEmailResponse = {
      data,
      total: contarPropostas(emails),
      por_remetente: contarPropostasPorRemetente(emails),
      quase_propostas: linhas.filter((l) => l.motivo_revisao !== null).length,
    };

    return NextResponse.json(body);
  } catch (e) {
    // Card vazio é melhor que /diario quebrado: a fonte é nova e ainda pode estar sem dado.
    console.error('propostas-email:', e);
    return NextResponse.json(
      { data, total: 0, por_remetente: [], quase_propostas: 0, erro: true },
      { status: 200 }
    );
  }
}
