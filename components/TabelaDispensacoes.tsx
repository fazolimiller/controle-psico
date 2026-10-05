'use client';

import { useState, useEffect } from 'react';
import { Dispensacao, Anestesista } from '@/lib/types';
import { formatarDataHoraBR } from '@/lib/formatarData';
import { api } from '@/lib/useSessao';

interface Props {
  dispensacoes: Dispensacao[];
  onAtualizar: () => void;
  isAdmin: boolean;
}

type Edicao = { codigo_anestesista: string; codigo_caixa: string; codigo_atendimento_paciente: string; motivo: string };

const TH = 'text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide';

async function mensagemDeErro(res: Response, padrao: string) {
  const data = await res.json().catch(() => ({}));
  return (data && data.error) || padrao;
}

export default function TabelaDispensacoes({ dispensacoes, onAtualizar, isAdmin }: Props) {
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [edicao, setEdicao] = useState<Edicao>({ codigo_anestesista: '', codigo_caixa: '', codigo_atendimento_paciente: '', motivo: '' });
  const [processandoId, setProcessandoId] = useState<number | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [anestesistas, setAnestesistas] = useState<Anestesista[]>([]);
  const [erro, setErro] = useState('');
  // Quem devolveu, por linha. Sem escolha explícita, vale o anestesista que retirou.
  const [devolvidoPor, setDevolvidoPor] = useState<Record<number, string>>({});

  useEffect(() => {
    api('/api/anestesistas')
      .then((res) => (res.ok ? res.json() : []))
      .then(setAnestesistas)
      .catch(() => {});
  }, []);

  async function executar(id: number, acao: () => Promise<Response>, padrao: string, aoConcluir?: () => void) {
    setProcessandoId(id);
    setErro('');
    try {
      const res = await acao();
      if (!res.ok) {
        setErro(await mensagemDeErro(res, padrao));
        return;
      }
      aoConcluir?.();
      onAtualizar();
    } catch {
      setErro('Não foi possível falar com o servidor. Verifique a rede e tente novamente.');
    } finally {
      setProcessandoId(null);
    }
  }

  const registrarDevolucao = (d: Dispensacao) =>
    executar(
      d.id,
      () =>
        api(`/api/dispensacoes/${d.id}/devolucao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anestesista_devolucao_cracha: devolvidoPor[d.id] ?? d.codigo_anestesista }),
        }),
      'Erro ao registrar a devolução.'
    );

  function iniciarEdicao(d: Dispensacao) {
    setExcluindoId(null);
    setEditandoId(d.id);
    setEdicao({
      codigo_anestesista: d.codigo_anestesista,
      codigo_caixa: d.codigo_caixa,
      codigo_atendimento_paciente: d.codigo_atendimento_paciente,
      motivo: '',
    });
  }

  const salvarEdicao = (id: number) =>
    executar(
      id,
      () =>
        api(`/api/dispensacoes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...edicao, motivo: edicao.motivo.trim() || undefined }),
        }),
      'Erro ao salvar a correção.',
      () => setEditandoId(null)
    );

  function iniciarExclusao(id: number) {
    setEditandoId(null);
    setExcluindoId(id);
    setMotivoExclusao('');
  }

  const excluir = (id: number) =>
    executar(
      id,
      () =>
        api(`/api/dispensacoes/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo: motivoExclusao.trim() }),
        }),
      'Erro ao excluir o registro.',
      () => setExcluindoId(null)
    );

  if (dispensacoes.length === 0) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
        <p className="font-display text-lg" style={{ color: 'var(--ink)' }}>
          Nenhuma entrega encontrada
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>
          Registre uma entrega no formulário acima ou mude o filtro de caixas.
        </p>
      </div>
    );
  }

  // Bloco de ações compartilhado entre a tabela (telas largas) e os cartões (tablet/celular).
  function acoes(d: Dispensacao) {
    const ocupado = processandoId === d.id;

    if (excluindoId === d.id) {
      return (
        <div className="flex flex-col gap-2 w-full lg:w-72 lg:ml-auto">
          <p className="text-xs text-left" style={{ color: 'var(--red)' }}>
            Motivo da exclusão (fica registrado; o registro não é apagado do banco)
          </p>
          <input
            aria-label="Motivo da exclusão"
            value={motivoExclusao}
            onChange={(e) => setMotivoExclusao(e.target.value)}
            maxLength={500}
            placeholder="Ex.: entrega registrada em duplicidade"
            className="rounded border px-2 py-1.5 text-sm"
            style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setExcluindoId(null)} className="text-xs px-3 py-1.5 rounded" style={{ color: 'var(--ink-soft)' }}>
              Cancelar
            </button>
            <button
              onClick={() => excluir(d.id)}
              disabled={ocupado || motivoExclusao.trim().length < 5}
              className="text-xs px-3 py-1.5 rounded font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--red)' }}
            >
              {ocupado ? 'Excluindo…' : 'Confirmar exclusão'}
            </button>
          </div>
        </div>
      );
    }

    if (editandoId === d.id) {
      return (
        <div className="flex flex-col gap-2 w-full lg:w-64 lg:ml-auto">
          <input
            value={edicao.motivo}
            onChange={(e) => setEdicao({ ...edicao, motivo: e.target.value })}
            maxLength={500}
            placeholder="Motivo da correção (opcional)"
            className="rounded border px-2 py-1.5 text-sm"
            style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditandoId(null)} className="text-xs px-3 py-1.5 rounded" style={{ color: 'var(--ink-soft)' }}>
              Cancelar
            </button>
            <button
              onClick={() => salvarEdicao(d.id)}
              disabled={ocupado}
              className="text-xs px-3 py-1.5 rounded font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {ocupado ? 'Salvando…' : 'Salvar correção'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2 lg:gap-3 justify-end items-center">
        {d.status === 'em_posse' && (
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <select
              value={devolvidoPor[d.id] ?? d.codigo_anestesista}
              onChange={(e) => setDevolvidoPor((atual) => ({ ...atual, [d.id]: e.target.value }))}
              className="text-xs rounded border px-2 py-1.5 max-w-[200px]"
              style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              aria-label="Anestesista que está devolvendo a caixa"
              title="Anestesista que está devolvendo a caixa"
            >
              {/* O anestesista que retirou sempre aparece, mesmo que tenha saído do cadastro. */}
              {!anestesistas.some((a) => a.codigo_cracha === d.codigo_anestesista) && (
                <option value={d.codigo_anestesista}>{d.nome_anestesista || d.codigo_anestesista}</option>
              )}
              {anestesistas.map((a) => (
                <option key={a.codigo_cracha} value={a.codigo_cracha}>
                  {a.nome}
                </option>
              ))}
            </select>
            <button
              onClick={() => registrarDevolucao(d)}
              disabled={ocupado}
              className="text-xs font-medium px-3 py-1.5 rounded whitespace-nowrap disabled:opacity-50"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {ocupado ? 'Registrando…' : 'Registrar devolução'}
            </button>
          </div>
        )}
        {isAdmin && (
          <>
            <button onClick={() => iniciarEdicao(d)} className="text-xs font-medium px-2 py-1.5" style={{ color: 'var(--ink-soft)' }}>
              Corrigir
            </button>
            <button onClick={() => iniciarExclusao(d.id)} className="text-xs font-medium px-2 py-1.5" style={{ color: 'var(--red)' }}>
              Excluir
            </button>
          </>
        )}
      </div>
    );
  }

  function campoCodigo(d: Dispensacao, campo: 'codigo_anestesista' | 'codigo_caixa' | 'codigo_atendimento_paciente') {
    if (editandoId !== d.id) return null;
    return (
      <input
        value={edicao[campo]}
        onChange={(e) => setEdicao({ ...edicao, [campo]: e.target.value })}
        className="w-full rounded border px-2 py-1 font-mono"
        style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
        aria-label={campo}
      />
    );
  }

  function status(d: Dispensacao) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
        style={
          d.status === 'em_posse'
            ? { background: 'var(--amber-soft)', color: 'var(--amber)' }
            : { background: 'var(--accent-soft)', color: 'var(--accent)' }
        }
      >
        {d.status === 'em_posse' ? 'Em posse' : 'Devolvida'}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <p role="alert" className="text-sm rounded-lg px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-soft)' }}>
          {erro}
        </p>
      )}

      {/* Tablet e celular: um cartão por caixa */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {dispensacoes.map((d) => (
          <li key={d.id} className="rounded-2xl border p-4" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Caixa</p>
                {editandoId === d.id ? (
                  campoCodigo(d, "codigo_caixa")
                ) : (
                  <p className="font-mono text-lg" style={{ color: 'var(--ink)' }}>{d.codigo_caixa}</p>
                )}
              </div>
              {status(d)}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
              <div>
                <dt className="text-xs" style={{ color: 'var(--ink-soft)' }}>Anestesista</dt>
                <dd>
                  {editandoId === d.id ? (
                    campoCodigo(d, "codigo_anestesista")
                  ) : (
                    <>
                      {d.nome_anestesista || '—'} <span className="font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>{d.codigo_anestesista}</span>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--ink-soft)' }}>Atendimento</dt>
                <dd className="font-mono">
                  {editandoId === d.id ? campoCodigo(d, "codigo_atendimento_paciente") : d.codigo_atendimento_paciente}
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--ink-soft)' }}>Entrega</dt>
                <dd className="font-mono">{formatarDataHoraBR(d.horario_entrega)}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--ink-soft)' }}>Devolução</dt>
                <dd className="font-mono">{formatarDataHoraBR(d.horario_devolucao)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs" style={{ color: 'var(--ink-soft)' }}>Registrado por</dt>
                <dd style={{ color: 'var(--ink-soft)' }}>
                  {d.registrado_por_nome || '—'}
                  {d.devolvido_por_nome && d.devolvido_por_nome !== d.registrado_por_nome && ` · devolução: ${d.devolvido_por_nome}`}
                </dd>
              </div>
            </dl>
            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
              {acoes(d)}
            </div>
          </li>
        ))}
      </ul>

      {/* Telas largas: tabela */}
      <div className="hidden lg:block rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--ink-soft)' }}>
                <th className={TH}>Anestesista</th>
                <th className={TH}>Caixa</th>
                <th className={TH}>Atendimento</th>
                <th className={TH}>Entrega</th>
                <th className={TH}>Devolução</th>
                <th className={TH}>Registrado por</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dispensacoes.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td className="px-4 py-3 font-mono">
                    {editandoId === d.id ? (
                      campoCodigo(d, "codigo_anestesista")
                    ) : (
                      <div>
                        <div>{d.codigo_anestesista}</div>
                        {d.nome_anestesista && (
                          <div className="font-sans text-xs" style={{ color: 'var(--ink-soft)' }}>{d.nome_anestesista}</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">{editandoId === d.id ? campoCodigo(d, "codigo_caixa") : d.codigo_caixa}</td>
                  <td className="px-4 py-3 font-mono">
                    {editandoId === d.id ? campoCodigo(d, "codigo_atendimento_paciente") : d.codigo_atendimento_paciente}
                  </td>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">{formatarDataHoraBR(d.horario_entrega)}</td>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">{formatarDataHoraBR(d.horario_devolucao)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
                    <div>{d.registrado_por_nome || '—'}</div>
                    {d.devolvido_por_nome && d.devolvido_por_nome !== d.registrado_por_nome && (
                      <div className="mt-0.5">Devolução: {d.devolvido_por_nome}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {status(d)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {acoes(d)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
