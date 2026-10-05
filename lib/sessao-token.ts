// Assinatura e verificação do token de sessão (cookie httpOnly).
//
// Usa apenas a Web Crypto API, disponível tanto no Node.js quanto no Edge
// Runtime do middleware — assim existe uma única implementação.
//
// O token carrega: id do usuário, papel, horário do login (iat), horário da
// última atividade (atv) e a versão de sessão do usuário (sv). A versão é
// incrementada no banco quando a senha, o papel ou o status do usuário mudam,
// o que invalida imediatamente todos os tokens antigos daquele usuário.

export type Papel = 'admin' | 'funcionario';

export interface DadosSessao {
  userId: number;
  login: string;
  nome: string;
  papel: Papel;
  sv: number; // versão de sessão do usuário no banco
  iat: number; // login (ms desde epoch)
  atv: number; // última atividade (ms desde epoch)
}

export const NOME_COOKIE_SESSAO = 'psico_sessao';

const enc = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64url(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(segredo: string, mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const assinatura = await crypto.subtle.sign('HMAC', chave, enc.encode(mensagem));
  return base64url(new Uint8Array(assinatura));
}

/** Comparação em tempo constante, para não vazar informação por tempo de resposta. */
function iguaisTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function assinarToken(dados: DadosSessao, segredo: string): Promise<string> {
  const payload = base64url(enc.encode(JSON.stringify(dados)));
  return `${payload}.${await hmac(segredo, payload)}`;
}

export type ResultadoVerificacao =
  | { ok: true; dados: DadosSessao }
  | { ok: false; motivo: 'invalido' | 'inatividade' | 'expirado' };

export async function verificarToken(
  token: string,
  segredo: string,
  limites: { inatividadeMinutos: number; duracaoMaximaHoras: number },
  agora = Date.now()
): Promise<ResultadoVerificacao> {
  try {
    const partes = token.split('.');
    if (partes.length !== 2) return { ok: false, motivo: 'invalido' };
    const [payload, assinatura] = partes;
    const esperada = await hmac(segredo, payload);
    if (!iguaisTempoConstante(assinatura, esperada)) return { ok: false, motivo: 'invalido' };

    const dados = JSON.parse(new TextDecoder().decode(deBase64url(payload))) as DadosSessao;
    if (
      !Number.isInteger(dados.userId) ||
      (dados.papel !== 'admin' && dados.papel !== 'funcionario') ||
      typeof dados.iat !== 'number' ||
      typeof dados.atv !== 'number' ||
      typeof dados.sv !== 'number'
    ) {
      return { ok: false, motivo: 'invalido' };
    }
    if (agora - dados.iat > limites.duracaoMaximaHoras * 3600_000) return { ok: false, motivo: 'expirado' };
    if (agora - dados.atv > limites.inatividadeMinutos * 60_000) return { ok: false, motivo: 'inatividade' };
    return { ok: true, dados };
  } catch {
    return { ok: false, motivo: 'invalido' };
  }
}

export function opcoesCookie(seguro: boolean, duracaoMaximaHoras: number) {
  return {
    httpOnly: true,
    secure: seguro,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: duracaoMaximaHoras * 3600,
  };
}
