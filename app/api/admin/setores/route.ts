import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db-adapter';
import { ensureSetoresIniciais } from '@/lib/setores';

// GET /api/admin/setores — lista para a tela de gerenciamento (admin)
export async function GET() {
  await ensureSetoresIniciais();
  const rows = await query('SELECT * FROM setores ORDER BY id ASC');
  return NextResponse.json(rows);
}

// POST /api/admin/setores — criar novo setor (só admin)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const nome = (body.nome || '').trim();

  if (!nome) {
    return NextResponse.json({ error: 'O nome do setor é obrigatório.' }, { status: 400 });
  }

  const existente = await query('SELECT id FROM setores WHERE nome = ?', [nome]);
  if (existente.length > 0) {
    return NextResponse.json({ error: 'Já existe um setor com esse nome.' }, { status: 409 });
  }

  const result = await run('INSERT INTO setores (nome, ativo) VALUES (?, 1)', [nome], { returningId: true });
  const novo = await query('SELECT * FROM setores WHERE id = ?', [Number(result.lastInsertRowid)]);
  return NextResponse.json(novo[0], { status: 201 });
}
