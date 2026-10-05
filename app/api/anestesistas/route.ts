import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-adapter';
import { exigirSessao, rota } from '@/lib/auth';

// GET /api/anestesistas — anestesistas ativos, para resolver o nome na leitura do crachá.
export const GET = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req);
  if (!auth.ok) return auth.resposta;
  const linhas = await query(
    'SELECT codigo_cracha, nome, crm, ativo FROM anestesistas WHERE ativo = 1 AND excluido_em IS NULL ORDER BY nome ASC'
  );
  return NextResponse.json(linhas);
});
