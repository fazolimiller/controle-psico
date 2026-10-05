import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run, type Parametro } from '@/lib/db-adapter';
import { exigirSessao, rota } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { agoraUTC } from '@/lib/tempo';
import { booleano, codigo as validarCodigo, lerCorpo, textoObrigatorio } from '@/lib/validacao';

type Contexto = { params: Promise<{ codigo: string }> };

async function carregar(cracha: string) {
  return queryOne<Record<string, unknown>>('SELECT * FROM anestesistas WHERE codigo_cracha = ? AND excluido_em IS NULL', [cracha]);
}

// PATCH /api/admin/anestesistas/:codigo — editar nome, CRM ou status
export const PATCH = rota(async (req: NextRequest, { params }: Contexto) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;
  const cracha = validarCodigo((await params).codigo, 'código do crachá');

  const atual = await carregar(cracha);
  if (!atual) return NextResponse.json({ error: 'Anestesista não encontrado.' }, { status: 404 });

  const corpo = await lerCorpo(req);
  const sets: string[] = [];
  const valores: Parametro[] = [];
  const mudancas: Record<string, unknown> = {};
  if (corpo.nome !== undefined) {
    const nome = textoObrigatorio(corpo.nome, 'nome', 200);
    sets.push('nome = ?');
    valores.push(nome);
    mudancas.nome = { antes: atual.nome, depois: nome };
  }
  if (corpo.crm !== undefined) {
    const crm = textoObrigatorio(corpo.crm, 'CRM', 30);
    sets.push('crm = ?');
    valores.push(crm);
    mudancas.crm = { antes: atual.crm, depois: crm };
  }
  if (corpo.ativo !== undefined) {
    const ativo = booleano(corpo.ativo, 'ativo');
    sets.push('ativo = ?');
    valores.push(ativo ? 1 : 0);
    mudancas.ativo = { antes: Number(atual.ativo) === 1, depois: ativo };
  }

  if (sets.length > 0) {
    await run(`UPDATE anestesistas SET ${sets.join(', ')} WHERE codigo_cracha = ?`, [...valores, cracha]);
    await registrarAuditoria({
      acao: 'anestesista_alterado',
      usuarioId: sessao.userId,
      usuarioLogin: sessao.login,
      entidade: 'anestesista',
      entidadeId: cracha,
      detalhes: mudancas,
      req,
    });
  }
  return NextResponse.json(await carregar(cracha));
});

// DELETE /api/admin/anestesistas/:codigo — exclusão lógica do cadastro.
// Dispensações já registradas mantêm o nome gravado no momento da entrega.
export const DELETE = rota(async (req: NextRequest, { params }: Contexto) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;
  const cracha = validarCodigo((await params).codigo, 'código do crachá');

  const atual = await carregar(cracha);
  if (!atual) return NextResponse.json({ error: 'Anestesista não encontrado.' }, { status: 404 });

  await run('UPDATE anestesistas SET ativo = 0, excluido_em = ?, excluido_por_nome = ? WHERE codigo_cracha = ?', [
    agoraUTC(),
    sessao.nome,
    cracha,
  ]);
  await registrarAuditoria({
    acao: 'anestesista_excluido',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'anestesista',
    entidadeId: cracha,
    detalhes: { nome: atual.nome, crm: atual.crm },
    req,
  });
  return NextResponse.json({ ok: true });
});
