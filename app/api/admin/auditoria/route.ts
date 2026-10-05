import { NextRequest, NextResponse } from 'next/server';
import { query, limitar, type Parametro } from '@/lib/db-adapter';
import { exigirSessao, rota } from '@/lib/auth';
import { dataValida, intervaloDiaBrasil } from '@/lib/tempo';
import { ErroValidacao, textoOpcional } from '@/lib/validacao';

const MAX_LINHAS = 2000;

// GET /api/admin/auditoria?dataInicio=&dataFim=&acao=&usuario= — trilha de auditoria (somente admin)
export const GET = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;

  const sp = new URL(req.url).searchParams;
  const condicoes: string[] = [];
  const params: Parametro[] = [];

  const dataInicio = sp.get('dataInicio');
  const dataFim = sp.get('dataFim');
  if (dataInicio) {
    if (!dataValida(dataInicio)) throw new ErroValidacao('Data inicial inválida.');
    condicoes.push('ocorrido_em >= ?');
    params.push(intervaloDiaBrasil(dataInicio).inicio);
  }
  if (dataFim) {
    if (!dataValida(dataFim)) throw new ErroValidacao('Data final inválida.');
    condicoes.push('ocorrido_em < ?');
    params.push(intervaloDiaBrasil(dataFim).fim);
  }
  const acao = textoOpcional(sp.get('acao'), 'ação', 60);
  if (acao) {
    if (!/^[a-z_]+$/.test(acao)) throw new ErroValidacao('Ação inválida.');
    condicoes.push('acao = ?');
    params.push(acao);
  }
  const usuario = textoOpcional(sp.get('usuario'), 'usuário', 100);
  if (usuario) {
    condicoes.push('usuario_login = ?');
    params.push(usuario);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const linhas = await query(`SELECT * FROM auditoria ${where} ORDER BY ocorrido_em DESC, id DESC ${limitar(MAX_LINHAS)}`, params);
  return NextResponse.json({ linhas, limite: MAX_LINHAS });
});
