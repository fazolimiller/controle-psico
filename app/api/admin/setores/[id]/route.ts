import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db-adapter';

// PATCH /api/admin/setores/:id — editar nome de um setor
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const existente = await query('SELECT * FROM setores WHERE id = ?', [id]);
  if (existente.length === 0) {
    return NextResponse.json({ error: 'Setor não encontrado.' }, { status: 404 });
  }

  const updates: string[] = [];
  const params_: (string | number)[] = [];

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (!nome) {
      return NextResponse.json({ error: 'O nome do setor não pode ficar vazio.' }, { status: 400 });
    }
    const duplicado = await query('SELECT id FROM setores WHERE nome = ? AND id != ?', [nome, id]);
    if (duplicado.length > 0) {
      return NextResponse.json({ error: 'Já existe um setor com esse nome.' }, { status: 409 });
    }
    updates.push('nome = ?');
    params_.push(nome);
  }

  if (updates.length > 0) {
    params_.push(id);
    await run(`UPDATE setores SET ${updates.join(', ')} WHERE id = ?`, params_);
  }

  const atualizado = await query('SELECT * FROM setores WHERE id = ?', [id]);
  return NextResponse.json(atualizado[0]);
}

// DELETE /api/admin/setores/:id — remover setor (não afeta dispensações já registradas,
// que mantêm o nome do setor gravado no momento da entrega)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await run('DELETE FROM setores WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
