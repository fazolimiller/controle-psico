'use client';

import { useState, useEffect } from 'react';

export interface SessaoUsuario {
  userId: number;
  login: string;
  nome: string;
  papel: 'admin' | 'funcionario';
}

export function useSessao() {
  const [sessao, setSessao] = useState<SessaoUsuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setSessao)
      .finally(() => setCarregando(false));
  }, []);

  return { sessao, carregando, isAdmin: sessao?.papel === 'admin' };
}
