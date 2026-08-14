'use client';

import Link from 'next/link';

const SECOES = [
  {
    href: '/admin/anestesistas',
    titulo: 'Anestesistas',
    descricao: 'Vincular o código do crachá ao nome do anestesista, para que apareça automaticamente nas entregas.',
  },
  {
    href: '/admin/usuarios',
    titulo: 'Usuários',
    descricao: 'Criar e gerenciar logins da equipe da farmácia — quem acessa o sistema e com qual permissão.',
  },
];

export default function AdminIndexPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="border-b" style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
            ← Voltar
          </Link>
          <h1 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Administração</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECOES.map((secao) => (
          <Link
            key={secao.href}
            href={secao.href}
            className="rounded-2xl border p-5 transition-shadow hover:shadow-sm"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--line)' }}
          >
            <h2 className="font-display text-lg" style={{ color: 'var(--ink)' }}>{secao.titulo}</h2>
            <p className="text-sm mt-1.5" style={{ color: 'var(--ink-soft)' }}>{secao.descricao}</p>
          </Link>
        ))}
      </main>
    </div>
  );
}
