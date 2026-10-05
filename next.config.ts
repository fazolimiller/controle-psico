import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera um pacote autossuficiente em .next/standalone, próprio para rodar no
  // servidor da instituição com "node server.js" (ver DEPLOY.md).
  output: 'standalone',
  // Não anuncia a tecnologia usada no cabeçalho X-Powered-By.
  poweredByHeader: false,
  // Drivers de banco carregados direto do node_modules, sem empacotamento.
  serverExternalPackages: ['oracledb', 'pg'],
};

export default nextConfig;
