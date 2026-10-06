// Proxy (antigo "middleware") — primeira barreira de toda requisição.
//
//  1. Cabeçalhos de segurança, incluindo Content Security Policy com nonce.
//  2. Bloqueio de requisições de escrita vindas de outra origem (CSRF).
//  3. Redireciona para o login quem não tem sessão válida (assinatura,
//     inatividade e duração máxima são verificadas aqui).
//  4. Renova o horário de última atividade da sessão (expiração por inatividade).
//
// A autorização definitiva (usuário ativo, papel, versão de sessão) é feita
// em cada rota da API por lib/auth.ts, consultando o banco.

import { NextRequest, NextResponse } from 'next/server';
import { configSessao, segredoSessao } from './lib/config';
import { assinarToken, opcoesCookie, verificarToken, NOME_COOKIE_SESSAO } from './lib/sessao-token';

const ROTAS_PUBLICAS = new Set(['/login', '/api/auth/login', '/api/auth/logout', '/api/saude']);
const ARQUIVO_ESTATICO = /\.(png|jpe?g|svg|webp|gif|ico|avif|woff2?)$/i;
const METODOS_ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Renova o cookie no máximo uma vez por minuto, para não reescrevê-lo a cada requisição.
const INTERVALO_RENOVACAO_MS = 60_000;

function politicaCSP(nonce: string, https: boolean): string {
  const dev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // A interface usa atributos style="" (React), que exigem 'unsafe-inline' em style-src.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

function aplicarCabecalhos(res: NextResponse, csp: string, https: boolean) {
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // HSTS só quando a requisição chegou de fato por HTTPS (nunca em http://localhost),
  // senão o navegador passa a exigir HTTPS num endereço que só fala HTTP.
  if (https) res.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return res;
}

/** Requisição de escrita só é aceita se vier da própria aplicação. */
function origemValida(req: NextRequest): boolean {
  const origem = req.headers.get('origin');
  if (!origem) {
    // Navegadores modernos sempre enviam Origin em POST/PATCH/DELETE via fetch.
    // Sem Origin, aceitamos apenas se o Sec-Fetch-Site indicar mesma origem.
    const site = req.headers.get('sec-fetch-site');
    return site === null || site === 'same-origin' || site === 'none';
  }
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cfg = configSessao();
  const nonce = btoa(crypto.randomUUID());
  // Atrás de proxy reverso (nginx/IIS/Vercel), o protocolo original vem em X-Forwarded-Proto.
  const https =
    req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https' || req.nextUrl.protocol === 'https:';
  const csp = politicaCSP(nonce, https);
  const ehApi = pathname.startsWith('/api/');

  if (ehApi && METODOS_ESCRITA.has(req.method) && !origemValida(req)) {
    return aplicarCabecalhos(
      NextResponse.json({ error: 'Requisição de origem não permitida.' }, { status: 403 }),
      csp,
      https
    );
  }

  const cabecalhosReq = new Headers(req.headers);
  cabecalhosReq.set('x-nonce', nonce);
  cabecalhosReq.set('Content-Security-Policy', csp);
  const seguir = () => NextResponse.next({ request: { headers: cabecalhosReq } });

  if (ROTAS_PUBLICAS.has(pathname) || ARQUIVO_ESTATICO.test(pathname)) {
    return aplicarCabecalhos(seguir(), csp, https);
  }

  const token = req.cookies.get(NOME_COOKIE_SESSAO)?.value;
  const verificacao = token ? await verificarToken(token, segredoSessao(), cfg) : null;

  if (!verificacao || !verificacao.ok) {
    let res: NextResponse;
    if (ehApi) {
      res = NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 });
    } else {
      const url = new URL('/login', req.url);
      if (verificacao && !verificacao.ok && verificacao.motivo !== 'invalido') url.searchParams.set('expirada', '1');
      res = NextResponse.redirect(url);
    }
    if (token) res.cookies.delete(NOME_COOKIE_SESSAO);
    return aplicarCabecalhos(res, csp, https);
  }

  const { dados } = verificacao;
  const ehAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  if (ehAdmin && dados.papel !== 'admin') {
    const res = ehApi
      ? NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 })
      : NextResponse.redirect(new URL('/', req.url));
    return aplicarCabecalhos(res, csp, https);
  }

  const res = seguir();
  const agora = Date.now();
  if (agora - dados.atv > INTERVALO_RENOVACAO_MS) {
    const novo = await assinarToken({ ...dados, atv: agora }, segredoSessao());
    res.cookies.set(NOME_COOKIE_SESSAO, novo, opcoesCookie(cfg.cookieSeguro, cfg.duracaoMaximaHoras));
  }
  return aplicarCabecalhos(res, csp, https);
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
