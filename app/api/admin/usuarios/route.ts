import { NextRequest, NextResponse } from 'next/server';
import { listarUsuarios, criarUsuario } from '@/lib/usuarios';
import { queryOne } from '@/lib/db-adapter';
import { exigirSessao, rota } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { ErroValidacao, lerCorpo, papelValido, textoObrigatorio, validarSenha } from '@/lib/validacao';

export const GET = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  return NextResponse.json(await listarUsuarios());
});

export const POST = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;

  const corpo = await lerCorpo(req);
  const login = textoObrigatorio(corpo.login, 'login', 100);
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(login)) {
    throw new ErroValidacao('O login deve ter de 3 a 100 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.');
  }
  const nome = textoObrigatorio(corpo.nome, 'nome', 200);
  const senha = validarSenha(corpo.senha);
  const papel = papelValido(corpo.papel ?? 'funcionario');

  if (await queryOne('SELECT id FROM usuarios WHERE login = ?', [login])) {
    return NextResponse.json({ error: 'Já existe um usuário com esse login.' }, { status: 409 });
  }

  const novo = await criarUsuario(login, nome, senha, papel);
  await registrarAuditoria({
    acao: 'usuario_criado',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'usuario',
    entidadeId: novo.id,
    detalhes: { login, nome, papel },
    req,
  });
  return NextResponse.json(novo, { status: 201 });
});
