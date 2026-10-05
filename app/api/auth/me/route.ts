import { NextRequest, NextResponse } from 'next/server';
import { exigirSessao, rota } from '@/lib/auth';

export const GET = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, undefined, { permitirTrocaSenhaPendente: true });
  if (!auth.ok) return auth.resposta;
  return NextResponse.json(auth.sessao);
});
