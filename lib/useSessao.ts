'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface SessaoUsuario {
  userId: number;
  login: string;
  nome: string;
  papel: 'admin' | 'funcionario';
  deveTrocarSenha: boolean;
}

export function useSessao() {
  const [sessao, setSessao] = useState<SessaoUsuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((s: SessaoUsuario | null) => {
        setSessao(s);
        if (s?.deveTrocarSenha) router.replace('/trocar-senha');
      })
      .finally(() => setCarregando(false));
  }, [router]);

  return { sessao, carregando, isAdmin: sessao?.papel === 'admin' };
}

/**
 * fetch para a API que leva o usuário de volta ao login quando a sessão
 * expira (inatividade) e para a troca de senha quando ela é obrigatória.
 */
export async function api(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login?expirada=1';
  } else if (res.status === 403 && typeof window !== 'undefined') {
    const corpo = await res.clone().json().catch(() => null);
    if (corpo?.codigo === 'TROCA_SENHA_OBRIGATORIA') window.location.href = '/trocar-senha';
  }
  return res;
}
