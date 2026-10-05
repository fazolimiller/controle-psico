'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Dispensacao } from '@/lib/types';
import { formatarDataHoraBR, hojeLocalISO } from '@/lib/formatarData';
import { api, useSessao } from '@/lib/useSessao';

function primeiroDiaDoMes(): string {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}-01`;
}

// Formata uma data "pura" de calendário (YYYY-MM-DD, sem horário associado —
// ex: valor de um <input type="date">) para DD/MM/YYYY. Não passa pela
// conversão de fuso horário usada nos timestamps do banco, porque aqui não há
// hora nenhuma a converter — é só a data que o usuário escolheu no calendário.
function formatarDataCalendario(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-');
  if (!ano || !mes || !dia) return dataISO;
  return `${dia}/${mes}/${ano}`;
}

const CABECALHOS = [
  'Caixa',
  'Setor',
  'Código Anestesista',
  'Nome Anestesista',
  'Anestesista Devolução',
  'Atendimento',
  'Kit Venosa',
  'Horário Dispensação',
  'Horário Devolução',
  'Registrado por',
  'Devolvido por',
  'Status',
];

const CABECALHOS_EXCLUSAO = ['Excluído em', 'Excluído por', 'Motivo da exclusão'];

function rotuloStatus(d: Dispensacao): string {
  if (d.excluido_em) return 'Excluída';
  return d.status === 'em_posse' ? 'Em posse' : 'Devolvida';
}

// Proteção contra "CSV/fórmula injection": um texto que começa com = + - @
// seria executado como fórmula ao abrir o arquivo no Excel.
function celulaSegura(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function linhaParaExportacao(d: Dispensacao): string[] {
  return [
    d.codigo_caixa,
    d.setor_nome || '',
    d.codigo_anestesista,
    d.nome_anestesista || '',
    d.anestesista_devolucao_nome || '',
    d.codigo_atendimento_paciente,
    d.kit_venoso ? 'Sim' : 'Não',
    formatarDataHoraBR(d.horario_entrega),
    formatarDataHoraBR(d.horario_devolucao),
    d.registrado_por_nome || '',
    d.devolvido_por_nome || '',
    rotuloStatus(d),
  ].map(celulaSegura);
}

export default function RelatoriosPage() {
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes());
  const [dataFim, setDataFim] = useState(hojeLocalISO());
  const [busca, setBusca] = useState('');
  const [dispensacoes, setDispensacoes] = useState<Dispensacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [exportandoXlsx, setExportandoXlsx] = useState(false);
  const [incluirExcluidas, setIncluirExcluidas] = useState(false);
  const { isAdmin } = useSessao();

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);
    if (incluirExcluidas) params.set('incluirExcluidas', '1');
    const res = await api(`/api/dispensacoes?${params}`);
    if (res.ok) setDispensacoes(await res.json());
    setCarregando(false);
  }, [dataInicio, dataFim, incluirExcluidas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const linhasFiltradas = busca
    ? dispensacoes.filter((d) =>
        [
          d.codigo_caixa,
          d.setor_nome,
          d.codigo_anestesista,
          d.nome_anestesista,
          d.anestesista_devolucao_nome,
          d.codigo_atendimento_paciente,
          d.registrado_por_nome,
          d.devolvido_por_nome,
        ]
          .join(' ')
          .toLowerCase()
          .includes(busca.toLowerCase())
      )
    : dispensacoes;

  function tabelaExportacao(): string[][] {
    const cabecalhos = incluirExcluidas ? [...CABECALHOS, ...CABECALHOS_EXCLUSAO] : CABECALHOS;
    const linhas = linhasFiltradas.map((d) => {
      const base = linhaParaExportacao(d);
      if (!incluirExcluidas) return base;
      return [
        ...base,
        ...[d.excluido_em ? formatarDataHoraBR(d.excluido_em) : '', d.excluido_por_nome || '', d.motivo_exclusao || ''].map(celulaSegura),
      ];
    });
    return [cabecalhos, ...linhas];
  }

  function exportarCSV() {
    if (linhasFiltradas.length === 0) return;

    const csvRows = tabelaExportacao().map((linha) =>
      linha.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    );
    // BOM no início ajuda o Excel a reconhecer acentos corretamente
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-dispensacoes-${dataInicio || 'inicio'}-a-${dataFim || 'fim'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarXLSX() {
    if (linhasFiltradas.length === 0) return;
    setExportandoXlsx(true);
    try {
      const writeExcelFile = (await import('write-excel-file/browser')).default;
      const sheetData = tabelaExportacao();
      await writeExcelFile(sheetData).toFile(
        `relatorio-dispensacoes-${dataInicio || 'inicio'}-a-${dataFim || 'fim'}.xlsx`
      );
    } finally {
      setExportandoXlsx(false);
    }
  }

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
        <div>
          <h2 className="font-display text-2xl" style={{ color: 'var(--ink)' }}>
            {formatarDataCalendario(dataInicio)} — {formatarDataCalendario(dataFim)}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ink-soft)' }}>
            {linhasFiltradas.length} {linhasFiltradas.length === 1 ? 'caixa dispensada' : 'caixas dispensadas'} no período
          </p>
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
              placeholder="Caixa, setor, anestesista, atendimento, funcionário…"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)' }}
            />
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm py-2" style={{ color: 'var(--ink-soft)' }}>
              <input
                type="checkbox"
                checked={incluirExcluidas}
                onChange={(e) => setIncluirExcluidas(e.target.checked)}
                className="h-4 w-4"
              />
              Incluir registros excluídos
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportarCSV}
              disabled={linhasFiltradas.length === 0}
              className="text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 whitespace-nowrap"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              Exportar CSV
            </button>
            <button
              onClick={exportarXLSX}
              disabled={linhasFiltradas.length === 0 || exportandoXlsx}
              className="text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 whitespace-nowrap"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {exportandoXlsx ? 'Gerando…' : 'Exportar Excel'}
            </button>
          </div>
        </div>

        {carregando ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--ink-soft)' }}>Carregando…</div>
        ) : linhasFiltradas.length === 0 ? (
          <div
            className="rounded-2xl border p-10 text-center"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
          >
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Nenhuma dispensação encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Caixa</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Setor</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Anestesista</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Anestesista Devolução</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Atendimento</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Kit Venosa</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Dispensação</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Devolução</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Funcionário</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasFiltradas.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{d.codigo_caixa}</td>
                      <td className="px-4 py-3">{d.setor_nome || '—'}</td>
                      <td className="px-4 py-3 font-mono">
                        <div>{d.codigo_anestesista}</div>
                        {d.nome_anestesista && (
                          <div className="font-sans text-xs" style={{ color: 'var(--ink-soft)' }}>{d.nome_anestesista}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {d.anestesista_devolucao_nome ? (
                          <span
                            style={{
                              color:
                                d.anestesista_devolucao_cracha !== d.codigo_anestesista
                                  ? 'var(--amber)'
                                  : 'var(--ink-soft)',
                            }}
                          >
                            {d.anestesista_devolucao_nome}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">{d.codigo_atendimento_paciente}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                          style={
                            d.kit_venoso
                              ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                              : { background: 'var(--line)', color: 'var(--ink-soft)' }
                          }
                        >
                          {d.kit_venoso ? 'Sim' : 'Não'}
                        </span>
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
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
                          style={
                            d.excluido_em
                              ? { background: 'var(--red-soft)', color: 'var(--red)' }
                              : d.status === 'em_posse'
                                ? { background: 'var(--amber-soft)', color: 'var(--amber)' }
                                : { background: 'var(--accent-soft)', color: 'var(--accent)' }
                          }
                        >
                          {rotuloStatus(d)}
                        </span>
                        {d.excluido_em && (
                          <div className="text-xs mt-1 max-w-[220px]" style={{ color: 'var(--ink-soft)' }}>
                            {formatarDataHoraBR(d.excluido_em)} por {d.excluido_por_nome || '—'}: {d.motivo_exclusao}
                          </div>
                        )}
                      </td>
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
