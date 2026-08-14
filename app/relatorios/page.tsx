'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type TipoRelatorio = 'anestesista' | 'paciente' | 'caixa';

interface LinhaAnestesista {
  codigo_anestesista: string;
  nome_anestesista: string | null;
  total_caixas: number;
  caixas_em_posse: number;
  caixas_devolvidas: number;
}

interface LinhaPaciente {
  codigo_atendimento_paciente: string;
  total_caixas: number;
  anestesistas_envolvidos: string;
}

interface LinhaCaixa {
  codigo_caixa: string;
  total_movimentacoes: number;
  ultima_movimentacao: string;
}

type Linha = LinhaAnestesista | LinhaPaciente | LinhaCaixa;

const TABS: { id: TipoRelatorio; label: string }[] = [
  { id: 'anestesista', label: 'Por anestesista' },
  { id: 'paciente', label: 'Por paciente' },
  { id: 'caixa', label: 'Por caixa' },
];

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState<TipoRelatorio>('anestesista');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams({ tipo });
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);
    const res = await fetch(`/api/relatorios?${params}`);
    if (res.ok) setLinhas(await res.json());
    setCarregando(false);
  }, [tipo, dataInicio, dataFim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function exportarCSV() {
    if (linhas.length === 0) return;
    const headers = Object.keys(linhas[0]);
    const csvRows = [
      headers.join(','),
      ...linhas.map((linha) =>
        headers.map((h) => `"${String((linha as unknown as Record<string, unknown>)[h] ?? '')}"`).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const linhasFiltradas = busca
    ? linhas.filter((l) => JSON.stringify(l).toLowerCase().includes(busca.toLowerCase()))
    : linhas;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="border-b" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
              ← Voltar
            </Link>
            <h1 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Relatórios</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTipo(tab.id)}
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={
                tipo === tab.id
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--bg-panel)', color: 'var(--ink-soft)', border: '1px solid var(--line)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className="rounded-2xl border p-4 flex flex-wrap items-end gap-3"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-soft)' }}>
              De
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-soft)' }}>
              Até
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)' }}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-soft)' }}>
              Buscar
            </label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar resultados…"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)' }}
            />
          </div>
          <button
            onClick={exportarCSV}
            disabled={linhasFiltradas.length === 0}
            className="text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            Exportar CSV
          </button>
        </div>

        {carregando ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--ink-soft)' }}>Carregando…</div>
        ) : linhasFiltradas.length === 0 ? (
          <div
            className="rounded-2xl border p-10 text-center"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
          >
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Nenhum resultado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    {Object.keys(linhasFiltradas[0]).map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                        {h.replaceAll('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhasFiltradas.map((linha, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                      {Object.values(linha as unknown as Record<string, unknown>).map((v, j) => (
                        <td key={j} className="px-4 py-3 font-mono">{String(v ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
