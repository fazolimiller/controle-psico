// Autenticação e autorização do lado do servidor.
//
// O middleware faz uma primeira barreira (redireciona quem não está logado),
// mas a decisão que vale é tomada aqui, em cada rota da API: o token é
// verificado e o usuário é relido do banco a cada requisição. Assim, um
// usuário desativado, rebaixado de papel ou com senha trocada perde o acesso
// na hora — não só quando o cookie expira.

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { configSessao, segredoSessao } from './config';
import { queryOne } from './db-adapter';
import {
  assinarToken,
  opcoesCookie,
  verificarToken,
  NOME_COOKIE_SESSAO,
  type DadosSessao,
  type Papel,
} from './sessao-token';
import { registrarAuditoria } from './auditoria';
import { ErroValidacao } from './validacao';
import { ErroConfiguracao } from './config';

export type { Papel, DadosSessao };
export const SESSION_COOKIE_NAME = NOME_COOKIE_SESSAO;

export interface Sessao {
  userId: number;
  login: string;
  nome: string;
  papel: Papel;
  deveTrocarSenha: boolean;
}

interface UsuarioSessao {
  id: number;
  login: string;
  nome: string;
  papel: Papel;
  ativo: number;
  sessao_versao: number;
  deve_trocar_senha: number;
}

async function lerToken(): Promise<DadosSessao | null> {
  const token = (await cookies()).get(NOME_COOKIE_SESSAO)?.value;
  if (!token) return null;
  const r = await verificarToken(token, segredoSessao(), configSessao());
  return r.ok ? r.dados : null;
}

/** Sessão válida e confirmada no banco, ou null. */
export async function getSession(): Promise<Sessao | null> {
  const dados = await lerToken();
  if (!dados) return null;
  const u = await queryOne<UsuarioSessao>(
    'SELECT id, login, nome, papel, ativo, sessao_versao, deve_trocar_senha FROM usuarios WHERE id = ?',
    [dados.userId]
  );
  if (!u || Number(u.ativo) !== 1 || Number(u.sessao_versao) !== dados.sv) return null;
  return {
    userId: Number(u.id),
    login: u.login,
    nome: u.nome,
    papel: u.papel,
    deveTrocarSenha: Number(u.deve_trocar_senha) === 1,
  };
}

type ResultadoAutorizacao = { ok: true; sessao: Sessao } | { ok: false; resposta: NextResponse };

/**
 * Exige usuário autenticado e, opcionalmente, um dos papéis informados.
 * Uso em toda rota:
 *   const auth = await exigirSessao(req, ['admin']);
 *   if (!auth.ok) return auth.resposta;
 */
export async function exigirSessao(
  req: Request,
  papeis?: Papel[],
  opcoes: { permitirTrocaSenhaPendente?: boolean } = {}
): Promise<ResultadoAutorizacao> {
  const sessao = await getSession();
  if (!sessao) {
    return { ok: false, resposta: NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 }) };
  }
  if (sessao.deveTrocarSenha && !opcoes.permitirTrocaSenhaPendente) {
    return {
      ok: false,
      resposta: NextResponse.json(
        { error: 'É necessário trocar a senha antes de continuar.', codigo: 'TROCA_SENHA_OBRIGATORIA' },
        { status: 403 }
      ),
    };
  }
  if (papeis && !papeis.includes(sessao.papel)) {
    await registrarAuditoria({
      acao: 'acesso_negado',
      usuarioId: sessao.userId,
      usuarioLogin: sessao.login,
      detalhes: { metodo: req.method, caminho: new URL(req.url).pathname },
      req,
    });
    return { ok: false, resposta: NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 }) };
  }
  return { ok: true, sessao };
}

/** Grava o cookie de sessão (login e troca de senha). */
export async function gravarCookieSessao(
  resposta: NextResponse,
  usuario: { id: number; login: string; nome: string; papel: Papel; sessao_versao: number }
) {
  const agora = Date.now();
  const cfg = configSessao();
  const token = await assinarToken(
    { userId: usuario.id, login: usuario.login, nome: usuario.nome, papel: usuario.papel, sv: usuario.sessao_versao, iat: agora, atv: agora },
    segredoSessao()
  );
  resposta.cookies.set(NOME_COOKIE_SESSAO, token, opcoesCookie(cfg.cookieSeguro, cfg.duracaoMaximaHoras));
}

/**
 * Envolve o handler da rota: transforma erros de validação em 400 e qualquer
 * outro erro em 500 genérico (o detalhe vai só para o log do servidor, nunca
 * para o navegador).
 */
export function rota<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ErroValidacao) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (e instanceof ErroConfiguracao) {
        console.error(e.message);
        return NextResponse.json({ error: 'Servidor com configuração incompleta. Contate a TI.' }, { status: 500 });
      }
      console.error('[api] erro não tratado', e);
      return NextResponse.json({ error: 'Erro interno. Tente novamente ou contate a TI.' }, { status: 500 });
    }
  };
}
