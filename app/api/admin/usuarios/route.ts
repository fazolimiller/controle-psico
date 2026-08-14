import { NextRequest, NextResponse } from 'next/server';
import { listarUsuarios, criarUsuario } from '@/lib/usuarios';
import { query } from '@/lib/db-adapter';

export async function GET() {
  const usuarios = await listarUsuarios();
  return NextResponse.json(usuarios);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { login, nome, senha, papel } = body;

  if (!login || !nome || !senha) {
    return NextResponse.json({ error: 'Login, nome e senha são obrigatórios.' }, { status: 400 });
  }

  if (senha.length < 4) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 4 caracteres.' }, { status: 400 });
  }

  const papelFinal = papel === 'admin' ? 'admin' : 'funcionario';

  const existente = await query('SELECT id FROM usuarios WHERE login = ?', [login]);
  if (existente.length > 0) {
    return NextResponse.json({ error: 'Já existe um usuário com esse login.' }, { status: 409 });
  }

  const novo = await criarUsuario(login, nome, senha, papelFinal);
  return NextResponse.json(novo, { status: 201 });
}
