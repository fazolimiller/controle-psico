'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Sessao {
  nome: string;
  login: string;
  deveTrocarSenha: boolean;
}

const REGRAS = [
  { texto: 'Pelo menos 8 caracteres', ok: (s: string) => s.length >= 8 },
  { texto: 'Letras e números', ok: (s: string) => /[A-Za-zÀ-ÿ]/.test(s) && /\d/.test(s) },
];

export default function TrocarSenhaPage() {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) router.replace('/login');
        return res.ok ? res.json() : null;
      })
      .then(setSessao)
      .catch(() => {});
  }, [router]);

  const regrasAtendidas = REGRAS.every((r) => r.ok(novaSenha));
  const confere = novaSenha.length > 0 && novaSenha === confirmacao;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!regrasAtendidas) return setErro('A nova senha não atende aos requisitos.');
    if (!confere) return setErro('A confirmação não confere com a nova senha.');

    setSalvando(true);
    try {
      const res = await fetch('/api/auth/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) router.replace('/login?expirada=1');
        throw new Error(data.error || 'Não foi possível trocar a senha.');
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setSalvando(false);
    }
  }

  const obrigatoria = sessao?.deveTrocarSenha;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl" style={{ color: 'var(--ink)' }}>
          {obrigatoria ? 'Crie sua senha pessoal' : 'Trocar senha'}
        </h1>
        <p className="text-sm mt-1.5 mb-6" style={{ color: 'var(--ink-soft)' }}>
          {obrigatoria
            ? 'Sua senha atual foi definida por um administrador. Para continuar, escolha uma senha que só você conheça.'
            : 'Depois da troca, outras sessões abertas com a senha antiga serão encerradas.'}
        </p>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 border flex flex-col gap-4"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
        >
          {sessao && (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              Usuário: <span className="font-mono" style={{ color: 'var(--ink)' }}>{sessao.login}</span>
            </p>
          )}
          <Campo id="atual" rotulo="Senha atual" valor={senhaAtual} onChange={setSenhaAtual} autoComplete="current-password" />
          <Campo id="nova" rotulo="Nova senha" valor={novaSenha} onChange={setNovaSenha} autoComplete="new-password" />
          <ul className="text-xs flex flex-col gap-1 -mt-2">
            {REGRAS.map((r) => {
              const ok = r.ok(novaSenha);
              return (
                <li key={r.texto} style={{ color: ok ? 'var(--accent)' : 'var(--ink-soft)' }}>
                  {ok ? '✓' : '○'} {r.texto}
                </li>
              );
            })}
          </ul>
          <Campo id="confirmacao" rotulo="Confirme a nova senha" valor={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />

          {erro && (
            <p role="alert" className="text-sm rounded-lg px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-soft)' }}>
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={salvando || !senhaAtual || !regrasAtendidas || !confere}
            className="w-full rounded-lg py-2.5 font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {salvando ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>

        {sessao && !obrigatoria && (
          <Link href="/" className="block text-center text-sm mt-4" style={{ color: 'var(--ink-soft)' }}>
            Voltar sem trocar
          </Link>
        )}
      </div>
    </div>
  );
}

function Campo(props: { id: string; rotulo: string; valor: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <div>
      <label htmlFor={props.id} className="block text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>
        {props.rotulo}
      </label>
      <input
        id={props.id}
        type="password"
        value={props.valor}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        className="w-full rounded-lg border px-3 py-2.5 text-base"
        style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
      />
    </div>
  );
}
