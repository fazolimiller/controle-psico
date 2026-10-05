'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { EventoAuditoria } from '@/lib/types';
import { formatarDataHoraBR, hojeLocalISO } from '@/lib/formatarData';
import { api } from '@/lib/useSessao';

const ACOES: Record<string, string> = {
  login: 'Login',
  login_falha: 'Login com falha',
  login_bloqueado: 'Usuário bloqueado',
  logout: 'Saída',
  senha_alterada: 'Senha alterada',
  dispensacao_criada: 'Entrega registrada',
  dispensacao_devolvida: 'Devolução registrada',
  dispensacao_corrigida: 'Registro corrigido',
  dispensacao_excluida: 'Registro excluído',
  usuario_criado: 'Usuário criado',
  usuario_alterado: 'Usuário alterado',
  anestesista_salvo: 'Anestesista cadastrado',
  anestesista_alterado: 'Anestesista alterado',
  anestesista_excluido: 'Anestesista removido',
  setor_criado: 'Setor criado',
  setor_alterado: 'Setor alterado',
  setor_excluido: 'Setor removido',
  acesso_negado: 'Acesso negado',
};

const ALERTA = new Set(['login_falha', 'login_bloqueado', 'dispensacao_excluida', 'acesso_negado']);

function seteDiasAtras(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resumirDetalhes(json: string | null): string {
  if (!json) return '';
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ');
  } catch {
    return json;
  }
}

function celulaSegura(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

const CAMPO = 'rounded-lg border px-3 py-2 text-sm';

export default function AuditoriaPage() {
  const [dataInicio, setDataInicio] = useState(seteDiasAtras());
  const [dataFim, setDataFim] = useState(hojeLocalISO());
  const [acao, setAcao] = useState('');
  const [usuario, setUsuario] = useState('');
  const [linhas, setLinhas] = useState<EventoAuditoria[]>([]);
  const [limite, setLimite] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    const params = new URLSearchParams();
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);
    if (acao) params.set('acao', acao);
    if (usuario.trim()) params.set('usuario', usuario.trim());
    const res = await api(`/api/admin/auditoria?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLinhas(data.linhas);
      setLimite(data.limite);
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.error || 'Não foi possível carregar a auditoria.');
    }
    setCarregando(false);
  }, [dataInicio, dataFim, acao, usuario]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  function exportarCSV() {
    const cab = ['Data/hora', 'Usuário', 'Ação', 'Entidade', 'Identificador', 'Detalhes', 'IP'];
    const corpo = linhas.map((l) =>
      [
        formatarDataHoraBR(l.ocorrido_em),
        l.usuario_login || '',
        ACOES[l.acao] || l.acao,
        l.entidade || '',
        l.entidade_id || '',
        resumirDetalhes(l.detalhes),
        l.ip || '',
      ].map(celulaSegura)
    );
    const csv = [cab, ...corpo].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${dataInicio}-a-${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="border-b" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4">
          <Link href="/admin" className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
            ← Administração
          </Link>
          <h1 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Auditoria</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-5">
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Registro permanente de acessos e alterações. Os eventos não podem ser editados nem apagados pelo sistema.
        </p>

        <div className="rounded-2xl border p-4 flex flex-wrap items-end gap-3" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
          <Filtro rotulo="De">
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={CAMPO} style={{ borderColor: 'var(--line)' }} />
          </Filtro>
          <Filtro rotulo="Até">
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={CAMPO} style={{ borderColor: 'var(--line)' }} />
          </Filtro>
          <Filtro rotulo="Ação">
            <select value={acao} onChange={(e) => setAcao(e.target.value)} className={CAMPO} style={{ borderColor: 'var(--line)', background: 'var(--bg-panel)' }}>
              <option value="">Todas</option>
              {Object.entries(ACOES).map(([valor, nome]) => (
                <option key={valor} value={valor}>
                  {nome}
                </option>
              ))}
            </select>
          </Filtro>
          <Filtro rotulo="Usuário (login)">
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} className={`${CAMPO} font-mono`} style={{ borderColor: 'var(--line)' }} />
          </Filtro>
          <button
            onClick={exportarCSV}
            disabled={linhas.length === 0}
            className="text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 whitespace-nowrap"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            Exportar CSV
          </button>
        </div>

        {erro && (
          <p role="alert" className="text-sm rounded-lg px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-soft)' }}>
            {erro}
          </p>
        )}

        {!carregando && linhas.length >= limite && limite > 0 && (
          <p className="text-sm" style={{ color: 'var(--amber)' }}>
            Mostrando os {limite} eventos mais recentes. Reduza o período para ver todos.
          </p>
        )}

        {carregando ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--ink-soft)' }}>Carregando…</div>
        ) : linhas.length === 0 ? (
          <div className="rounded-2xl border p-10 text-center text-sm" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
            Nenhum evento no período e filtros selecionados.
          </div>
        ) : (
          <div className="rounded-2xl border overflow-x-auto" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--ink-soft)' }}>
                  {['Data/hora', 'Usuário', 'Ação', 'Detalhes', 'IP'].map((t) => (
                    <th key={t} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{formatarDataHoraBR(l.ocorrido_em)}</td>
                    <td className="px-4 py-3 font-mono">{l.usuario_login || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: ALERTA.has(l.acao) ? 'var(--red)' : 'var(--ink)' }}>
                      {ACOES[l.acao] || l.acao}
                      {l.entidade_id && (
                        <span className="text-xs ml-1" style={{ color: 'var(--ink-soft)' }}>
                          #{l.entidade_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs break-words max-w-[420px]" style={{ color: 'var(--ink-soft)' }}>
                      {resumirDetalhes(l.detalhes)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>{l.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function Filtro({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col">
      <span className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-soft)' }}>
        {rotulo}
      </span>
      {children}
    </label>
  );
}
