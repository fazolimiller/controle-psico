import { NextRequest, NextResponse } from 'next/server';
import { exigirSessao, gravarCookieSessao, rota } from '@/lib/auth';
import { conferirSenha, trocarPropriaSenha } from '@/lib/usuarios';
import { registrarAuditoria } from '@/lib/auditoria';
import { lerCorpo, validarSenha } from '@/lib/validacao';

// POST /api/auth/trocar-senha — o próprio usuário troca a senha (obrigatório no primeiro acesso).
export const POST = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, undefined, { permitirTrocaSenhaPendente: true });
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;

  const corpo = await lerCorpo(req);
  const senhaAtual = typeof corpo.senhaAtual === 'string' ? corpo.senhaAtual : '';
  const novaSenha = validarSenha(corpo.novaSenha);

  if (!(await conferirSenha(sessao.userId, senhaAtual))) {
    return NextResponse.json({ error: 'A senha atual está incorreta.' }, { status: 400 });
  }
  if (novaSenha === senhaAtual) {
    return NextResponse.json({ error: 'A nova senha deve ser diferente da atual.' }, { status: 400 });
  }
  if (novaSenha.toLowerCase().includes(sessao.login.toLowerCase())) {
    return NextResponse.json({ error: 'A senha não pode conter o seu login.' }, { status: 400 });
  }

  const novaVersao = await trocarPropriaSenha(sessao.userId, novaSenha);
  await registrarAuditoria({ acao: 'senha_alterada', usuarioId: sessao.userId, usuarioLogin: sessao.login, req });

  // A troca invalida as sessões antigas; esta recebe um cookie novo.
  const resposta = NextResponse.json({ ok: true });
  await gravarCookieSessao(resposta, {
    id: sessao.userId,
    login: sessao.login,
    nome: sessao.nome,
    papel: sessao.papel,
    sessao_versao: novaVersao,
  });
  return resposta;
});
