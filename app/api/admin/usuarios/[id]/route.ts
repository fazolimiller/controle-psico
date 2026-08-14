import { NextRequest, NextResponse } from 'next/server';
import { atualizarUsuario } from '@/lib/usuarios';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const session = await getSession();

  // Impede que o admin se autodesative (evita ficar todo mundo trancado de fora)
  if (Number(id) === session?.userId && body.ativo === false) {
    return NextResponse.json({ error: 'Você não pode desativar seu próprio usuário.' }, { status: 400 });
  }

  if (body.senha && body.senha.length > 0 && body.senha.length < 4) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 4 caracteres.' }, { status: 400 });
  }

  const atualizado = await atualizarUsuario(Number(id), {
    nome: body.nome,
    papel: body.papel,
    ativo: body.ativo,
    senha: body.senha || undefined,
  });

  if (!atualizado) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  return NextResponse.json(atualizado);
}
