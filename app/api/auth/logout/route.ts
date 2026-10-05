import { NextRequest, NextResponse } from 'next/server';
import { getSession, rota, SESSION_COOKIE_NAME } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';

export const POST = rota(async (req: NextRequest) => {
  const sessao = await getSession().catch(() => null);
  if (sessao) await registrarAuditoria({ acao: 'logout', usuarioId: sessao.userId, usuarioLogin: sessao.login, req });
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.delete(SESSION_COOKIE_NAME);
  return resposta;
});
