import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db-adapter';
import { getSession } from '@/lib/auth';

const CAMPOS_EDITAVEIS = [
  'codigo_anestesista',
  'codigo_caixa',
  'codigo_atendimento_paciente',
  'horario_entrega',
  'horario_devolucao',
  'observacoes',
] as const;

// PATCH /api/dispensacoes/:id — corrigir erro de digitação (SOMENTE ADMIN), com histórico
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (session?.papel !== 'admin') {
    return NextResponse.json({ error: 'Somente administradores podem corrigir registros.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const linhaAtual = (await query<Record<string, unknown>>('SELECT * FROM dispensacoes WHERE id = ?', [id]))[0];

  if (!linhaAtual) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  }

  const updates: string[] = [];
  const updateParams: (string | number | null)[] = [];

  for (const campo of CAMPOS_EDITAVEIS) {
    if (campo in body && body[campo] !== linhaAtual[campo]) {
      updates.push(`${campo} = ?`);
      updateParams.push(body[campo]);
      await run(
        `INSERT INTO historico_edicoes (dispensacao_id, campo_alterado, valor_anterior, valor_novo, editado_por_id, editado_por_nome)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, campo, String(linhaAtual[campo] ?? ''), String(body[campo] ?? ''), session.userId, session.nome]
      );
    }
  }

  if (updates.length === 0) {
    return NextResponse.json(linhaAtual);
  }

  updates.push("atualizado_em = CURRENT_TIMESTAMP");
  updateParams.push(id);

  await run(`UPDATE dispensacoes SET ${updates.join(', ')} WHERE id = ?`, updateParams);

  const linhaAtualizada = (await query('SELECT * FROM dispensacoes WHERE id = ?', [id]))[0];
  return NextResponse.json(linhaAtualizada);
}

// DELETE /api/dispensacoes/:id — excluir registro (SOMENTE ADMIN)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (session?.papel !== 'admin') {
    return NextResponse.json({ error: 'Somente administradores podem excluir registros.' }, { status: 403 });
  }

  const { id } = await params;

  const linha = (await query('SELECT id FROM dispensacoes WHERE id = ?', [id]))[0];
  if (!linha) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  }

  await run('DELETE FROM historico_edicoes WHERE dispensacao_id = ?', [id]);
  await run('DELETE FROM dispensacoes WHERE id = ?', [id]);

  return NextResponse.json({ ok: true });
}

// GET /api/dispensacoes/:id — detalhe + histórico de edições
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const linha = (await query<Record<string, unknown>>('SELECT * FROM dispensacoes WHERE id = ?', [id]))[0];
  if (!linha) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  }

  const historico = await query(
    'SELECT * FROM historico_edicoes WHERE dispensacao_id = ? ORDER BY alterado_em DESC',
    [id]
  );

  return NextResponse.json({ ...linha, historico });
}
