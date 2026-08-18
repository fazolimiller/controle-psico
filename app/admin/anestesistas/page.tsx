'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import Link from 'next/link';
import { Anestesista } from '@/lib/types';

export default function AnestesistasAdminPage() {
  const [lista, setLista] = useState<Anestesista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [crm, setCrm] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editandoCodigo, setEditandoCodigo] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [crmEdicao, setCrmEdicao] = useState('');
  const [erroEdicao, setErroEdicao] = useState('');
  const codigoRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch('/api/admin/anestesistas');
    if (res.ok) setLista(await res.json());
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');

    if (!codigo.trim() || !nome.trim() || !crm.trim()) {
      setErro('Código do crachá, nome e CRM são obrigatórios.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/admin/anestesistas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_cracha: codigo.trim(), nome: nome.trim(), crm: crm.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao cadastrar.');
      }
      setCodigo('');
      setNome('');
      setCrm('');
      await carregar();
      codigoRef.current?.focus();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar.');
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(a: Anestesista) {
    setEditandoCodigo(a.codigo_cracha);
    setNomeEdicao(a.nome);
    setCrmEdicao(a.crm || '');
    setErroEdicao('');
  }

  async function salvarEdicao(codigoCracha: string) {
    setErroEdicao('');
    if (!nomeEdicao.trim() || !crmEdicao.trim()) {
      setErroEdicao('Nome e CRM são obrigatórios.');
      return;
    }
    const res = await fetch(`/api/admin/anestesistas/${encodeURIComponent(codigoCracha)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nomeEdicao, crm: crmEdicao.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErroEdicao(data.error || 'Erro ao salvar.');
      return;
    }
    setEditandoCodigo(null);
    carregar();
  }

  async function remover(codigoCracha: string) {
    await fetch(`/api/admin/anestesistas/${encodeURIComponent(codigoCracha)}`, { method: 'DELETE' });
    carregar();
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="border-b" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4">
          <Link href="/admin" className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
            ← Administração
          </Link>
          <h1 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Anestesistas</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-5">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border p-5"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
        >
          <h2 className="font-display text-lg mb-1" style={{ color: 'var(--ink)' }}>Vincular novo crachá</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--ink-soft)' }}>
            Aproxime o crachá do leitor no campo de código, ou digite manualmente.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                Código do crachá
              </label>
              <input
                ref={codigoRef}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="font-mono w-full rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                Nome do anestesista
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Dr(a). Nome Completo"
                className="w-full rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                CRM
              </label>
              <input
                value={crm}
                onChange={(e) => setCrm(e.target.value)}
                placeholder="12345-SP"
                className="font-mono w-full rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              />
            </div>
          </div>

          {erro && (
            <p className="text-sm mt-3 rounded-lg px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-soft)' }}>
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="mt-4 rounded-lg px-5 py-2.5 font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {salvando ? 'Salvando…' : 'Salvar vínculo'}
          </button>
        </form>

        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
          {carregando ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--ink-soft)' }}>Carregando…</div>
          ) : lista.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--ink-soft)' }}>
              Nenhum anestesista cadastrado ainda.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Crachá</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>CRM</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => {
                  const emEdicao = editandoCodigo === a.codigo_cracha;
                  return (
                    <tr key={a.codigo_cracha} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td className="px-4 py-3 font-mono">{a.codigo_cracha}</td>
                      <td className="px-4 py-3">
                        {emEdicao ? (
                          <input
                            value={nomeEdicao}
                            onChange={(e) => setNomeEdicao(e.target.value)}
                            className="w-full rounded border px-2 py-1"
                            style={{ borderColor: 'var(--line)' }}
                          />
                        ) : (
                          a.nome
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {emEdicao ? (
                          <input
                            value={crmEdicao}
                            onChange={(e) => setCrmEdicao(e.target.value)}
                            className="w-full rounded border px-2 py-1 font-mono"
                            style={{ borderColor: 'var(--line)' }}
                          />
                        ) : (
                          a.crm || '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {emEdicao ? (
                          <div className="flex flex-col gap-2 items-end">
                            {erroEdicao && (
                              <p className="text-xs" style={{ color: 'var(--red)' }}>{erroEdicao}</p>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => setEditandoCodigo(null)} className="text-xs px-2 py-1" style={{ color: 'var(--ink-soft)' }}>
                                Cancelar
                              </button>
                              <button
                                onClick={() => salvarEdicao(a.codigo_cracha)}
                                className="text-xs px-3 py-1 rounded font-medium text-white"
                                style={{ background: 'var(--accent)' }}
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 justify-end">
                            <button onClick={() => iniciarEdicao(a)} className="text-xs font-medium" style={{ color: 'var(--ink-soft)' }}>
                              Editar
                            </button>
                            <button onClick={() => remover(a.codigo_cracha)} className="text-xs font-medium" style={{ color: 'var(--red)' }}>
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
