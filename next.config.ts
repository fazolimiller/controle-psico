import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera um pacote autossuficiente em .next/standalone, próprio para rodar no
  // servidor da instituição com "node server.js" (ver DEPLOY.md).
  // Desligado no Vercel: lá o build não usa esse formato, e o Next 16.3 com
  // "standalone" deixa de gerar arquivos que o Vercel exige (erro ENOENT em
  // next-server.js.nft.json). O Vercel define a variável VERCEL=1 no build.
  output: process.env.VERCEL ? undefined : 'standalone',
  // Não anuncia a tecnologia usada no cabeçalho X-Powered-By.
  poweredByHeader: false,
  // Drivers de banco carregados direto do node_modules, sem empacotamento.
  serverExternalPackages: ['oracledb', 'pg'],
};

export default nextConfig;
