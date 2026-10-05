import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db-adapter';
import { exigirSessao, rota } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { agoraUTC } from '@/lib/tempo';
import { codigo, lerCorpo, textoObrigatorio } from '@/lib/validacao';

// GET /api/admin/anestesistas — cadastro completo (exceto excluídos)
export const GET = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  return NextResponse.json(await query('SELECT * FROM anestesistas WHERE excluido_em IS NULL ORDER BY nome ASC'));
});

// POST /api/admin/anestesistas — vincular crachá → nome/CRM. Se o crachá já
// existiu e foi excluído, o cadastro é reativado com os novos dados.
export const POST = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;

  const corpo = await lerCorpo(req);
  const cracha = codigo(corpo.codigo_cracha, 'código do crachá');
  const nome = textoObrigatorio(corpo.nome, 'nome', 200);
  const crm = textoObrigatorio(corpo.crm, 'CRM', 30);

  const existente = await queryOne<{ nome: string; crm: string | null; excluido_em: string | null }>(
    'SELECT nome, crm, excluido_em FROM anestesistas WHERE codigo_cracha = ?',
    [cracha]
  );
  if (existente) {
    await run('UPDATE anestesistas SET nome = ?, crm = ?, ativo = 1, excluido_em = NULL, excluido_por_nome = NULL WHERE codigo_cracha = ?', [
      nome,
      crm,
      cracha,
    ]);
  } else {
    await run('INSERT INTO anestesistas (codigo_cracha, nome, crm, ativo, criado_em) VALUES (?, ?, ?, 1, ?)', [
      cracha,
      nome,
      crm,
      agoraUTC(),
    ]);
  }

  await registrarAuditoria({
    acao: 'anestesista_salvo',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'anestesista',
    entidadeId: cracha,
    detalhes: existente
      ? { reativado: !!existente.excluido_em, antes: { nome: existente.nome, crm: existente.crm }, depois: { nome, crm } }
      : { nome, crm },
    req,
  });

  return NextResponse.json(await queryOne('SELECT * FROM anestesistas WHERE codigo_cracha = ?', [cracha]), { status: 201 });
});
