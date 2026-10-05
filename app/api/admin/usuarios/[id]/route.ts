import { NextRequest, NextResponse } from 'next/server';
import { atualizarUsuario, buscarUsuarioPublico, contarAdminsAtivos } from '@/lib/usuarios';
import { exigirSessao, rota } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { booleano, ErroValidacao, idValido, lerCorpo, papelValido, textoObrigatorio, validarSenha } from '@/lib/validacao';

export const PATCH = rota(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;
  const id = idValido((await params).id);
  if (!id) throw new ErroValidacao('Identificador inválido.');

  const atual = await buscarUsuarioPublico(id);
  if (!atual) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

  const corpo = await lerCorpo(req);
  const dados: Parameters<typeof atualizarUsuario>[1] = {};
  if (corpo.nome !== undefined) dados.nome = textoObrigatorio(corpo.nome, 'nome', 200);
  if (corpo.papel !== undefined) dados.papel = papelValido(corpo.papel);
  if (corpo.ativo !== undefined) dados.ativo = booleano(corpo.ativo, 'ativo');
  if (corpo.senha !== undefined && corpo.senha !== '') dados.senha = validarSenha(corpo.senha);
  if (corpo.desbloquear === true) dados.desbloquear = true;

  if (id === sessao.userId && (dados.ativo === false || (dados.papel && dados.papel !== 'admin'))) {
    return NextResponse.json({ error: 'Você não pode desativar nem rebaixar o seu próprio usuário.' }, { status: 400 });
  }
  const deixaDeSerAdminAtivo =
    atual.papel === 'admin' && Number(atual.ativo) === 1 && (dados.ativo === false || (dados.papel && dados.papel !== 'admin'));
  if (deixaDeSerAdminAtivo && (await contarAdminsAtivos(id)) === 0) {
    return NextResponse.json({ error: 'É preciso manter pelo menos um administrador ativo.' }, { status: 400 });
  }

  const atualizado = await atualizarUsuario(id, dados);
  await registrarAuditoria({
    acao: 'usuario_alterado',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'usuario',
    entidadeId: id,
    detalhes: {
      login: atual.login,
      ...(dados.nome !== undefined && { nome: { antes: atual.nome, depois: dados.nome } }),
      ...(dados.papel !== undefined && { papel: { antes: atual.papel, depois: dados.papel } }),
      ...(dados.ativo !== undefined && { ativo: { antes: Number(atual.ativo) === 1, depois: dados.ativo } }),
      ...(dados.senha && { senha: 'redefinida pelo administrador' }),
      ...(dados.desbloquear && { desbloqueio: true }),
    },
    req,
  });
  return NextResponse.json(atualizado);
});
