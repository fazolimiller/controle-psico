'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FormularioEntrega from '@/components/FormularioEntrega';
import TabelaDispensacoes from '@/components/TabelaDispensacoes';
import { Dispensacao } from '@/lib/types';
import { useSessao } from '@/lib/useSessao';

function hojeISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatarDataExtenso(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function HomePage() {
  const [data, setData] = useState(hojeISO());
  const [dispensacoes, setDispensacoes] = useState<Dispensacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();
  const { sessao, isAdmin } = useSessao();

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch(`/api/dispensacoes?data=${data}`);
    if (res.ok) {
      setDispensacoes(await res.json());
    }
    setCarregando(false);
  }, [data]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const pendentes = dispensacoes.filter((d) => d.status === 'em_posse').length;
  const ehHoje = data === hojeISO();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header
        className="border-b sticky top-0 z-10"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl" style={{ color: 'var(--ink)' }}>
              Controle de Psicotrópicos
            </h1>
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Farmácia hospitalar</p>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/relatorios"
              className="text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--ink)' }}
            >
              Relatórios
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm font-medium px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--ink)' }}
              >
                Administração
              </Link>
            )}
            {sessao && (
              <span className="text-sm hidden sm:inline" style={{ color: 'var(--ink-soft)' }}>
                {sessao.nome}
              </span>
            )}
            <button onClick={handleLogout} className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl capitalize" style={{ color: 'var(--ink)' }}>
              {formatarDataExtenso(data)}
            </h2>
            {pendentes > 0 && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--amber)' }}>
                {pendentes} {pendentes === 1 ? 'caixa em posse' : 'caixas em posse'} aguardando devolução
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)', background: 'var(--bg-panel)' }}
            />
            {!ehHoje && (
              <button
                onClick={() => setData(hojeISO())}
                className="text-sm font-medium px-3 py-2 rounded-lg"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                Voltar para hoje
              </button>
            )}
          </div>
        </div>

        {ehHoje && <FormularioEntrega onSucesso={carregar} />}

        {carregando ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Carregando…
          </div>
        ) : (
          <TabelaDispensacoes dispensacoes={dispensacoes} onAtualizar={carregar} isAdmin={isAdmin} />
        )}
      </main>
    </div>
  );
}
