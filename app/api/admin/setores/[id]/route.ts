import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db-adapter';
import { exigirSessao, rota } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { agoraUTC } from '@/lib/tempo';
import { ErroValidacao, idValido, lerCorpo, textoObrigatorio } from '@/lib/validacao';

type Contexto = { params: Promise<{ id: string }> };

async function carregar(id: number) {
  return queryOne<{ id: number; nome: string }>('SELECT * FROM setores WHERE id = ? AND excluido_em IS NULL', [id]);
}

// PATCH /api/admin/setores/:id — renomear setor
export const PATCH = rota(async (req: NextRequest, { params }: Contexto) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;
  const id = idValido((await params).id);
  if (!id) throw new ErroValidacao('Identificador inválido.');

  const atual = await carregar(id);
  if (!atual) return NextResponse.json({ error: 'Setor não encontrado.' }, { status: 404 });

  const corpo = await lerCorpo(req);
  if (corpo.nome !== undefined) {
    const nome = textoObrigatorio(corpo.nome, 'nome do setor', 200);
    if (nome !== atual.nome) {
      // A checagem inclui setores excluídos, porque o nome continua reservado no banco.
      if (await queryOne('SELECT id FROM setores WHERE nome = ? AND id <> ?', [nome, id])) {
        return NextResponse.json(
          { error: 'Já existe (ou existiu) um setor com esse nome. Para reutilizá-lo, crie o setor novamente pelo nome.' },
          { status: 409 }
        );
      }
      await run('UPDATE setores SET nome = ? WHERE id = ?', [nome, id]);
      await registrarAuditoria({
        acao: 'setor_alterado',
        usuarioId: sessao.userId,
        usuarioLogin: sessao.login,
        entidade: 'setor',
        entidadeId: id,
        detalhes: { nome: { antes: atual.nome, depois: nome } },
        req,
      });
    }
  }
  return NextResponse.json(await carregar(id));
});

// DELETE /api/admin/setores/:id — exclusão lógica. Dispensações antigas mantêm
// o nome do setor gravado no momento da entrega.
export const DELETE = rota(async (req: NextRequest, { params }: Contexto) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;
  const id = idValido((await params).id);
  if (!id) throw new ErroValidacao('Identificador inválido.');

  const atual = await carregar(id);
  if (!atual) return NextResponse.json({ error: 'Setor não encontrado.' }, { status: 404 });

  await run('UPDATE setores SET ativo = 0, excluido_em = ?, excluido_por_nome = ? WHERE id = ?', [agoraUTC(), sessao.nome, id]);
  await registrarAuditoria({
    acao: 'setor_excluido',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'setor',
    entidadeId: id,
    detalhes: { nome: atual.nome },
    req,
  });
  return NextResponse.json({ ok: true });
});
