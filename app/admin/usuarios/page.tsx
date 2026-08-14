'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { UsuarioPublico } from '@/lib/types';

export default function UsuariosAdminPage() {
  const [lista, setLista] = useState<UsuarioPublico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [login, setLogin] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<'funcionario' | 'admin'>('funcionario');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [papelEdicao, setPapelEdicao] = useState<'funcionario' | 'admin'>('funcionario');
  const [novaSenhaEdicao, setNovaSenhaEdicao] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch('/api/admin/usuarios');
    if (res.ok) setLista(await res.json());
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');

    if (!login.trim() || !nome.trim() || !senha) {
      setErro('Preencha usuário, nome e senha.');
      return;
    }
    if (senha.length < 4) {
      setErro('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), nome: nome.trim(), senha, papel }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao criar usuário.');
      }
      setLogin('');
      setNome('');
      setSenha('');
      setPapel('funcionario');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar usuário.');
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(u: UsuarioPublico) {
    setEditandoId(u.id);
    setNomeEdicao(u.nome);
    setPapelEdicao(u.papel);
    setNovaSenhaEdicao('');
  }

  async function salvarEdicao(id: number) {
    const body: Record<string, unknown> = { nome: nomeEdicao, papel: papelEdicao };
    if (novaSenhaEdicao) body.senha = novaSenhaEdicao;
    await fetch(`/api/admin/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setEditandoId(null);
    carregar();
  }

  async function alternarAtivo(u: UsuarioPublico) {
    await fetch(`/api/admin/usuarios/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !u.ativo }),
    });
    carregar();
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="border-b" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4">
          <Link href="/admin" className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
            ← Administração
          </Link>
          <h1 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Usuários</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-5">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border p-5"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
        >
          <h2 className="font-display text-lg mb-4" style={{ color: 'var(--ink)' }}>Criar novo usuário</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                Login
              </label>
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="font-mono w-full rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                Nome
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                Senha inicial
              </label>
              <input
                type="text"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="font-mono w-full rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                Papel
              </label>
              <select
                value={papel}
                onChange={(e) => setPapel(e.target.value as 'funcionario' | 'admin')}
                className="w-full rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              >
                <option value="funcionario">Funcionário</option>
                <option value="admin">Administrador</option>
              </select>
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
            {salvando ? 'Criando…' : 'Criar usuário'}
          </button>
        </form>

        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
          {carregando ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--ink-soft)' }}>Carregando…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Login</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Papel</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => {
                  const emEdicao = editandoId === u.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td className="px-4 py-3 font-mono">{u.login}</td>
                      <td className="px-4 py-3">
                        {emEdicao ? (
                          <input
                            value={nomeEdicao}
                            onChange={(e) => setNomeEdicao(e.target.value)}
                            className="w-full rounded border px-2 py-1"
                            style={{ borderColor: 'var(--line)' }}
                          />
                        ) : (
                          u.nome
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {emEdicao ? (
                          <select
                            value={papelEdicao}
                            onChange={(e) => setPapelEdicao(e.target.value as 'funcionario' | 'admin')}
                            className="rounded border px-2 py-1"
                            style={{ borderColor: 'var(--line)' }}
                          >
                            <option value="funcionario">Funcionário</option>
                            <option value="admin">Administrador</option>
                          </select>
                        ) : (
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                            style={
                              u.papel === 'admin'
                                ? { background: 'var(--amber-soft)', color: 'var(--amber)' }
                                : { background: 'var(--accent-soft)', color: 'var(--accent)' }
                            }
                          >
                            {u.papel === 'admin' ? 'Administrador' : 'Funcionário'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: u.ativo ? 'var(--accent)' : 'var(--ink-soft)' }}>
                          {u.ativo ? 'Ativo' : 'Desativado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {emEdicao ? (
                          <div className="flex flex-col gap-2 items-end">
                            <input
                              type="text"
                              placeholder="Nova senha (opcional)"
                              value={novaSenhaEdicao}
                              onChange={(e) => setNovaSenhaEdicao(e.target.value)}
                              className="font-mono text-xs rounded border px-2 py-1 w-40"
                              style={{ borderColor: 'var(--line)' }}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => setEditandoId(null)} className="text-xs px-2 py-1" style={{ color: 'var(--ink-soft)' }}>
                                Cancelar
                              </button>
                              <button
                                onClick={() => salvarEdicao(u.id)}
                                className="text-xs px-3 py-1 rounded font-medium text-white"
                                style={{ background: 'var(--accent)' }}
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 justify-end">
                            <button onClick={() => iniciarEdicao(u)} className="text-xs font-medium" style={{ color: 'var(--ink-soft)' }}>
                              Editar
                            </button>
                            <button
                              onClick={() => alternarAtivo(u)}
                              className="text-xs font-medium"
                              style={{ color: u.ativo ? 'var(--red)' : 'var(--accent)' }}
                            >
                              {u.ativo ? 'Desativar' : 'Reativar'}
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
