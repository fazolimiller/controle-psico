import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db-adapter';

// PATCH /api/admin/anestesistas/:codigo — editar nome/CRM/status de um anestesista
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const body = await req.json();

  const existente = await query('SELECT * FROM anestesistas WHERE codigo_cracha = ?', [codigo]);
  if (existente.length === 0) {
    return NextResponse.json({ error: 'Anestesista não encontrado.' }, { status: 404 });
  }

  const updates: string[] = [];
  const paramsList: (string | number)[] = [];

  if (body.nome !== undefined) {
    updates.push('nome = ?');
    paramsList.push(body.nome);
  }
  if (body.crm !== undefined) {
    updates.push('crm = ?');
    paramsList.push(body.crm);
  }
  if (body.ativo !== undefined) {
    updates.push('ativo = ?');
    paramsList.push(body.ativo ? 1 : 0);
  }

  if (updates.length > 0) {
    paramsList.push(codigo);
    await run(`UPDATE anestesistas SET ${updates.join(', ')} WHERE codigo_cracha = ?`, paramsList);
  }

  const atualizado = await query('SELECT * FROM anestesistas WHERE codigo_cracha = ?', [codigo]);
  return NextResponse.json(atualizado[0]);
}

// DELETE /api/admin/anestesistas/:codigo — remover cadastro (não afeta dispensações já registradas)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  await run('DELETE FROM anestesistas WHERE codigo_cracha = ?', [codigo]);
  return NextResponse.json({ ok: true });
}
