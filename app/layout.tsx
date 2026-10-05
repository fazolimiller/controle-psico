import type { Metadata, Viewport } from 'next';
// Fontes servidas pela própria aplicação (sem chamadas a servidores externos):
// funcionam na rede interna sem internet e não expõem acessos a terceiros.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './globals.css';

// Renderização dinâmica é necessária para que cada página receba o nonce da
// Content Security Policy gerado no proxy (ver proxy.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Controle de Psicotrópicos — Farmácia',
  description: 'Sistema de controle de dispensação de caixas de psicotrópicos',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
