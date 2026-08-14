import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db-adapter';
import { getSession } from '@/lib/auth';

// POST /api/dispensacoes/:id/devolucao — registrar devolução da caixa
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await req.json().catch(() => ({}));

  const linha = (await query<Record<string, unknown>>('SELECT * FROM dispensacoes WHERE id = ?', [id]))[0];

  if (!linha) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  }

  if (linha.horario_devolucao) {
    return NextResponse.json({ error: 'Devolução já registrada para esta caixa.' }, { status: 400 });
  }

  const horarioDevolucao = body.horario_devolucao || new Date().toISOString().slice(0, 19).replace('T', ' ');

  await run(
    `UPDATE dispensacoes
     SET horario_devolucao = ?, status = 'devolvida', atualizado_em = CURRENT_TIMESTAMP,
         devolvido_por_id = ?, devolvido_por_nome = ?
     WHERE id = ?`,
    [horarioDevolucao, session?.userId ?? null, session?.nome ?? null, id]
  );

  const linhaAtualizada = (await query('SELECT * FROM dispensacoes WHERE id = ?', [id]))[0];
  return NextResponse.json(linhaAtualizada);
}
