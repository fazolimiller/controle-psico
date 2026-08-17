import { NextResponse } from 'next/server';
import { query } from '@/lib/db-adapter';
import { ensureSetoresIniciais } from '@/lib/setores';

// GET /api/setores — lista setores ativos, para qualquer usuário logado (abas)
export async function GET() {
  await ensureSetoresIniciais();
  const rows = await query('SELECT * FROM setores WHERE ativo = 1 ORDER BY id ASC');
  return NextResponse.json(rows);
}
