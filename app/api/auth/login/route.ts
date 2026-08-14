import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { autenticar } from '@/lib/usuarios';

export async function POST(req: NextRequest) {
  const { login, senha } = await req.json();

  if (!login || !senha) {
    return NextResponse.json({ error: 'Informe usuário e senha.' }, { status: 400 });
  }

  const usuario = await autenticar(login, senha);

  if (!usuario) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  const token = createSessionToken({
    userId: usuario.id,
    login: usuario.login,
    nome: usuario.nome,
    papel: usuario.papel,
  });

  const response = NextResponse.json({ ok: true, nome: usuario.nome, papel: usuario.papel });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return response;
}
