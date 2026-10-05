import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db-adapter';
import { exigirSessao, rota } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { agoraUTC } from '@/lib/tempo';
import { codigo, ErroValidacao, idValido, lerCorpo } from '@/lib/validacao';

// POST /api/dispensacoes/:id/devolucao — registrar devolução da caixa
export const POST = rota(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await exigirSessao(req, ['admin', 'funcionario']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;
  const id = idValido((await params).id);
  if (!id) throw new ErroValidacao('Identificador inválido.');

  const linha = await queryOne<Record<string, unknown>>('SELECT * FROM dispensacoes WHERE id = ? AND excluido_em IS NULL', [id]);
  if (!linha) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  if (linha.horario_devolucao) {
    return NextResponse.json({ error: 'Devolução já registrada para esta caixa.' }, { status: 409 });
  }

  const corpo = await lerCorpo(req).catch(() => ({}) as Record<string, unknown>);
  // Anestesista que devolveu: se não informado, o mesmo que retirou.
  const crachaDevolucao =
    corpo.anestesista_devolucao_cracha !== undefined && corpo.anestesista_devolucao_cracha !== ''
      ? codigo(corpo.anestesista_devolucao_cracha, 'anestesista da devolução')
      : String(linha.codigo_anestesista);

  const anestesista = await queryOne<{ nome: string }>(
    'SELECT nome FROM anestesistas WHERE codigo_cracha = ? AND ativo = 1 AND excluido_em IS NULL',
    [crachaDevolucao]
  );
  if (!anestesista) {
    return NextResponse.json({ error: 'Anestesista informado para a devolução não está cadastrado ou está inativo.' }, { status: 422 });
  }

  // O horário é sempre o do servidor.
  const agora = agoraUTC();
  // "AND horario_devolucao IS NULL" evita registrar duas devoluções em cliques simultâneos.
  const r = await run(
    `UPDATE dispensacoes
     SET horario_devolucao = ?, status = 'devolvida', atualizado_em = ?,
         devolvido_por_id = ?, devolvido_por_nome = ?,
         anestesista_devolucao_cracha = ?, anestesista_devolucao_nome = ?
     WHERE id = ? AND horario_devolucao IS NULL AND excluido_em IS NULL`,
    [agora, agora, sessao.userId, sessao.nome, crachaDevolucao, anestesista.nome, id]
  );
  if (r.changes === 0) {
    return NextResponse.json({ error: 'Devolução já registrada para esta caixa.' }, { status: 409 });
  }

  await registrarAuditoria({
    acao: 'dispensacao_devolvida',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'dispensacao',
    entidadeId: id,
    detalhes: { caixa: linha.codigo_caixa, anestesista_devolucao: crachaDevolucao },
    req,
  });

  return NextResponse.json(await queryOne('SELECT * FROM dispensacoes WHERE id = ?', [id]));
});
