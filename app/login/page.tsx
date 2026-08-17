'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const loginRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    loginRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha }),
    });

    setCarregando(false);

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.error || 'Usuário ou senha incorretos.');
      setSenha('');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/logo-santa-casa.png"
            alt="Santa Casa de São José dos Campos"
            width={1579}
            height={1045}
            priority
            className="mx-auto mb-5 h-auto w-full max-w-[240px]"
          />
          <h1 className="font-display text-2xl" style={{ color: 'var(--ink)' }}>
            Controle de Psicotrópicos
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>
            Farmácia - Santa Casa de São José dos Campos
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 border flex flex-col gap-4"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
        >
          <div>
            <label htmlFor="login" className="block text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>
              Usuário
            </label>
            <input
              ref={loginRef}
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-base"
              style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-base"
              style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              autoComplete="current-password"
            />
          </div>

          {erro && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-soft)' }}>
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando || !login || !senha}
            className="w-full rounded-lg py-2.5 font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
