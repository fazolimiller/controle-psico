'use client';

import { useState, useEffect } from 'react';
import { Dispensacao, Anestesista } from '@/lib/types';
import { formatarDataHoraBR } from '@/lib/formatarData';

interface Props {
  dispensacoes: Dispensacao[];
  onAtualizar: () => void;
  isAdmin: boolean;
}

export default function TabelaDispensacoes({ dispensacoes, onAtualizar, isAdmin }: Props) {
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [campoEdicao, setCampoEdicao] = useState<Record<string, string>>({});
  const [processandoId, setProcessandoId] = useState<number | null>(null);
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<number | null>(null);
  const [anestesistas, setAnestesistas] = useState<Anestesista[]>([]);
  // Guarda a escolha de quem devolveu, por linha. Quando não há escolha
  // explícita, usamos o anestesista que retirou a caixa (padrão).
  const [devolvidoPor, setDevolvidoPor] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch('/api/anestesistas')
      .then((res) => (res.ok ? res.json() : []))
      .then(setAnestesistas)
      .catch(() => {});
  }, []);

  async function registrarDevolucao(id: number, crachaEscolhido: string) {
    setProcessandoId(id);
    try {
      const res = await fetch(`/api/dispensacoes/${id}/devolucao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anestesista_devolucao_cracha: crachaEscolhido }),
      });
      if (res.ok) onAtualizar();
    } finally {
      setProcessandoId(null);
    }
  }

  function iniciarEdicao(disp: Dispensacao) {
    setEditandoId(disp.id);
    setCampoEdicao({
      codigo_anestesista: disp.codigo_anestesista,
      codigo_caixa: disp.codigo_caixa,
      codigo_atendimento_paciente: disp.codigo_atendimento_paciente,
    });
  }

  async function salvarEdicao(id: number) {
    setProcessandoId(id);
    try {
      const res = await fetch(`/api/dispensacoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campoEdicao),
      });
      if (res.ok) {
        setEditandoId(null);
        onAtualizar();
      }
    } finally {
      setProcessandoId(null);
    }
  }

  async function excluir(id: number) {
    setProcessandoId(id);
    try {
      const res = await fetch(`/api/dispensacoes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmandoExclusaoId(null);
        onAtualizar();
      }
    } finally {
      setProcessandoId(null);
    }
  }

  if (dispensacoes.length === 0) {
    return (
      <div
        className="rounded-2xl border p-10 text-center"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
      >
        <p className="font-display text-lg" style={{ color: 'var(--ink)' }}>
          Nenhuma entrega registrada ainda hoje
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>
          Use o formulário acima para registrar a primeira entrega do dia.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Anestesista</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Caixa</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Atendimento</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Entrega</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Devolução</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Registrado por</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Status</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {dispensacoes.map((disp) => {
              const emEdicao = editandoId === disp.id;
              const confirmandoExclusao = confirmandoExclusaoId === disp.id;
              return (
                <tr key={disp.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td className="px-4 py-3 font-mono">
                    {emEdicao ? (
                      <input
                        value={campoEdicao.codigo_anestesista}
                        onChange={(e) => setCampoEdicao({ ...campoEdicao, codigo_anestesista: e.target.value })}
                        className="w-full rounded border px-2 py-1 font-mono"
                        style={{ borderColor: 'var(--line)' }}
                      />
                    ) : (
                      <div>
                        <div>{disp.codigo_anestesista}</div>
                        {disp.nome_anestesista && (
                          <div className="font-sans text-xs" style={{ color: 'var(--ink-soft)' }}>{disp.nome_anestesista}</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {emEdicao ? (
                      <input
                        value={campoEdicao.codigo_caixa}
                        onChange={(e) => setCampoEdicao({ ...campoEdicao, codigo_caixa: e.target.value })}
                        className="w-full rounded border px-2 py-1 font-mono"
                        style={{ borderColor: 'var(--line)' }}
                      />
                    ) : (
                      disp.codigo_caixa
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {emEdicao ? (
                      <input
                        value={campoEdicao.codigo_atendimento_paciente}
                        onChange={(e) => setCampoEdicao({ ...campoEdicao, codigo_atendimento_paciente: e.target.value })}
                        className="w-full rounded border px-2 py-1 font-mono"
                        style={{ borderColor: 'var(--line)' }}
                      />
                    ) : (
                      disp.codigo_atendimento_paciente
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">{formatarDataHoraBR(disp.horario_entrega)}</td>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">{formatarDataHoraBR(disp.horario_devolucao)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
                    <div>{disp.registrado_por_nome || '—'}</div>
                    {disp.devolvido_por_nome && disp.devolvido_por_nome !== disp.registrado_por_nome && (
                      <div className="mt-0.5">Devolução: {disp.devolvido_por_nome}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                      style={
                        disp.status === 'em_posse'
                          ? { background: 'var(--amber-soft)', color: 'var(--amber)' }
                          : { background: 'var(--accent-soft)', color: 'var(--accent)' }
                      }
                    >
                      {disp.status === 'em_posse' ? 'Em posse' : 'Devolvida'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {confirmandoExclusao ? (
                      <div className="flex gap-2 justify-end items-center">
                        <span className="text-xs" style={{ color: 'var(--red)' }}>Excluir de vez?</span>
                        <button
                          onClick={() => setConfirmandoExclusaoId(null)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ color: 'var(--ink-soft)' }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => excluir(disp.id)}
                          disabled={processandoId === disp.id}
                          className="text-xs px-3 py-1 rounded font-medium text-white"
                          style={{ background: 'var(--red)' }}
                        >
                          Confirmar
                        </button>
                      </div>
                    ) : emEdicao ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditandoId(null)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ color: 'var(--ink-soft)' }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => salvarEdicao(disp.id)}
                          disabled={processandoId === disp.id}
                          className="text-xs px-3 py-1 rounded font-medium text-white"
                          style={{ background: 'var(--accent)' }}
                        >
                          Salvar
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3 justify-end items-center">
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => iniciarEdicao(disp)}
                              className="text-xs font-medium"
                              style={{ color: 'var(--ink-soft)' }}
                            >
                              Corrigir
                            </button>
                            <button
                              onClick={() => setConfirmandoExclusaoId(disp.id)}
                              className="text-xs font-medium"
                              style={{ color: 'var(--red)' }}
                            >
                              Excluir
                            </button>
                          </>
                        )}
                        {disp.status === 'em_posse' && (
                          <div className="flex items-center gap-2">
                            <select
                              value={devolvidoPor[disp.id] ?? disp.codigo_anestesista}
                              onChange={(e) =>
                                setDevolvidoPor((atual) => ({ ...atual, [disp.id]: e.target.value }))
                              }
                              className="text-xs rounded border px-2 py-1 max-w-[180px]"
                              style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                              title="Anestesista que está devolvendo a caixa"
                            >
                              {/* Garante que o anestesista que retirou apareça como opção,
                                  mesmo que tenha sido removido do cadastro depois. */}
                              {!anestesistas.some((a) => a.codigo_cracha === disp.codigo_anestesista) && (
                                <option value={disp.codigo_anestesista}>
                                  {disp.nome_anestesista || disp.codigo_anestesista}
                                </option>
                              )}
                              {anestesistas.map((a) => (
                                <option key={a.codigo_cracha} value={a.codigo_cracha}>
                                  {a.nome}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() =>
                                registrarDevolucao(disp.id, devolvidoPor[disp.id] ?? disp.codigo_anestesista)
                              }
                              disabled={processandoId === disp.id}
                              className="text-xs font-medium px-3 py-1 rounded whitespace-nowrap"
                              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                            >
                              {processandoId === disp.id ? 'Registrando…' : 'Registrar devolução'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
