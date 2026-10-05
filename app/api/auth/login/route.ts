import { NextRequest, NextResponse } from 'next/server';
import { gravarCookieSessao, rota } from '@/lib/auth';
import { autenticar } from '@/lib/usuarios';
import { registrarAuditoria } from '@/lib/auditoria';
import { lerCorpo } from '@/lib/validacao';

export const POST = rota(async (req: NextRequest) => {
  const corpo = await lerCorpo(req);
  const login = typeof corpo.login === 'string' ? corpo.login.trim().slice(0, 100) : '';
  const senha = typeof corpo.senha === 'string' ? corpo.senha.slice(0, 200) : '';

  if (!login || !senha) {
    return NextResponse.json({ error: 'Informe usuário e senha.' }, { status: 400 });
  }

  const r = await autenticar(login, senha);

  if (!r.ok) {
    if (r.motivo === 'bloqueado') {
      await registrarAuditoria({ acao: 'login_bloqueado', usuarioId: r.usuario?.id ?? null, usuarioLogin: login, req });
      return NextResponse.json(
        {
          error: `Usuário bloqueado temporariamente por excesso de tentativas. Tente novamente em ${r.minutosRestantes} minuto(s) ou peça a um administrador para desbloquear.`,
        },
        { status: 429 }
      );
    }
    await registrarAuditoria({ acao: 'login_falha', usuarioId: r.usuario?.id ?? null, usuarioLogin: login, req });
    return NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  const u = r.usuario;
  await registrarAuditoria({ acao: 'login', usuarioId: u.id, usuarioLogin: u.login, req });

  const resposta = NextResponse.json({
    ok: true,
    nome: u.nome,
    papel: u.papel,
    deveTrocarSenha: Number(u.deve_trocar_senha) === 1,
  });
  await gravarCookieSessao(resposta, u);
  return resposta;
});
