'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import Link from 'next/link';
import { Setor } from '@/lib/types';

export default function SetoresAdminPage() {
  const [lista, setLista] = useState<Setor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [confirmandoRemocaoId, setConfirmandoRemocaoId] = useState<number | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch('/api/admin/setores');
    if (res.ok) setLista(await res.json());
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');

    if (!nome.trim()) {
      setErro('O nome do setor é obrigatório.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/admin/setores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao criar setor.');
      }
      setNome('');
      await carregar();
      nomeRef.current?.focus();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar setor.');
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(s: Setor) {
    setEditandoId(s.id);
    setNomeEdicao(s.nome);
  }

  async function salvarEdicao(id: number) {
    const res = await fetch(`/api/admin/setores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nomeEdicao }),
    });
    if (res.ok) {
      setEditandoId(null);
      carregar();
    }
  }

  async function remover(id: number) {
    await fetch(`/api/admin/setores/${id}`, { method: 'DELETE' });
    setConfirmandoRemocaoId(null);
    carregar();
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="border-b" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4">
          <Link href="/admin" className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
            ← Administração
          </Link>
          <h1 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Setores</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-5">
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Os setores aparecem como abas na tela principal, para todos os usuários. Remover um setor não afeta as
          dispensações já registradas nele — o nome fica preservado no histórico.
        </p>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border p-5"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
        >
          <h2 className="font-display text-lg mb-4" style={{ color: 'var(--ink)' }}>Adicionar novo setor</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              ref={nomeRef}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Centro Cirúrgico 3"
              className="flex-1 rounded-lg border px-3 py-2.5"
              style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
            />
            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg px-5 py-2.5 font-medium text-white disabled:opacity-50 whitespace-nowrap"
              style={{ background: 'var(--accent)' }}
            >
              {salvando ? 'Salvando…' : 'Adicionar setor'}
            </button>
          </div>
          {erro && (
            <p className="text-sm mt-3 rounded-lg px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-soft)' }}>
              {erro}
            </p>
          )}
        </form>

        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
          {carregando ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--ink-soft)' }}>Carregando…</div>
          ) : lista.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--ink-soft)' }}>
              Nenhum setor cadastrado ainda.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Setor</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => {
                  const emEdicao = editandoId === s.id;
                  const confirmandoRemocao = confirmandoRemocaoId === s.id;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td className="px-4 py-3">
                        {emEdicao ? (
                          <input
                            value={nomeEdicao}
                            onChange={(e) => setNomeEdicao(e.target.value)}
                            className="w-full rounded border px-2 py-1"
                            style={{ borderColor: 'var(--line)' }}
                            autoFocus
                          />
                        ) : (
                          s.nome
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {confirmandoRemocao ? (
                          <div className="flex gap-2 justify-end items-center">
                            <span className="text-xs" style={{ color: 'var(--red)' }}>Remover setor?</span>
                            <button onClick={() => setConfirmandoRemocaoId(null)} className="text-xs px-2 py-1" style={{ color: 'var(--ink-soft)' }}>
                              Cancelar
                            </button>
                            <button
                              onClick={() => remover(s.id)}
                              className="text-xs px-3 py-1 rounded font-medium text-white"
                              style={{ background: 'var(--red)' }}
                            >
                              Confirmar
                            </button>
                          </div>
                        ) : emEdicao ? (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditandoId(null)} className="text-xs px-2 py-1" style={{ color: 'var(--ink-soft)' }}>
                              Cancelar
                            </button>
                            <button
                              onClick={() => salvarEdicao(s.id)}
                              className="text-xs px-3 py-1 rounded font-medium text-white"
                              style={{ background: 'var(--accent)' }}
                            >
                              Salvar
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-3 justify-end">
                            <button onClick={() => iniciarEdicao(s)} className="text-xs font-medium" style={{ color: 'var(--ink-soft)' }}>
                              Editar
                            </button>
                            <button onClick={() => setConfirmandoRemocaoId(s.id)} className="text-xs font-medium" style={{ color: 'var(--red)' }}>
                              Remover
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
