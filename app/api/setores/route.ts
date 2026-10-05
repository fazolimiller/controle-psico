import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-adapter';
import { ensureSetoresIniciais } from '@/lib/setores';
import { exigirSessao, rota } from '@/lib/auth';

// GET /api/setores — setores ativos (abas da tela principal)
export const GET = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req);
  if (!auth.ok) return auth.resposta;
  await ensureSetoresIniciais();
  return NextResponse.json(await query('SELECT id, nome, ativo FROM setores WHERE ativo = 1 AND excluido_em IS NULL ORDER BY id ASC'));
});
