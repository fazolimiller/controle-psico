import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db-adapter';
import { ensureSetoresIniciais } from '@/lib/setores';
import { exigirSessao, rota } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { agoraUTC } from '@/lib/tempo';
import { lerCorpo, textoObrigatorio } from '@/lib/validacao';

// GET /api/admin/setores — lista para a tela de gerenciamento (exceto excluídos)
export const GET = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  await ensureSetoresIniciais();
  return NextResponse.json(await query('SELECT * FROM setores WHERE excluido_em IS NULL ORDER BY id ASC'));
});

// POST /api/admin/setores — criar setor. Se já existiu um setor excluído com o
// mesmo nome, ele é reativado (preservando o mesmo id nas dispensações antigas).
export const POST = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;
  const nome = textoObrigatorio((await lerCorpo(req)).nome, 'nome do setor', 200);

  const existente = await queryOne<{ id: number; excluido_em: string | null }>('SELECT id, excluido_em FROM setores WHERE nome = ?', [nome]);
  let id: number;
  if (existente && !existente.excluido_em) {
    return NextResponse.json({ error: 'Já existe um setor com esse nome.' }, { status: 409 });
  } else if (existente) {
    id = Number(existente.id);
    await run('UPDATE setores SET ativo = 1, excluido_em = NULL, excluido_por_nome = NULL WHERE id = ?', [id]);
  } else {
    id = (await run('INSERT INTO setores (nome, ativo, criado_em) VALUES (?, 1, ?)', [nome, agoraUTC()], { returningId: true }))
      .lastInsertRowid;
  }

  await registrarAuditoria({
    acao: 'setor_criado',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'setor',
    entidadeId: id,
    detalhes: { nome, reativado: !!existente },
    req,
  });
  return NextResponse.json(await queryOne('SELECT * FROM setores WHERE id = ?', [id]), { status: 201 });
});
