// Trilha de auditoria: registra quem fez o quê, quando e de onde.
// A tabela "auditoria" só recebe INSERT (no Oracle, o usuário da aplicação
// nem tem permissão de UPDATE/DELETE nela).

import { run } from './db-adapter';
import { agoraUTC } from './tempo';

export type AcaoAuditoria =
  | 'login'
  | 'login_falha'
  | 'login_bloqueado'
  | 'logout'
  | 'senha_alterada'
  | 'dispensacao_criada'
  | 'dispensacao_devolvida'
  | 'dispensacao_corrigida'
  | 'dispensacao_excluida'
  | 'usuario_criado'
  | 'usuario_alterado'
  | 'anestesista_salvo'
  | 'anestesista_alterado'
  | 'anestesista_excluido'
  | 'setor_criado'
  | 'setor_alterado'
  | 'setor_excluido'
  | 'acesso_negado';

export interface EventoAuditoria {
  acao: AcaoAuditoria;
  usuarioId?: number | null;
  usuarioLogin?: string | null;
  entidade?: string;
  entidadeId?: string | number | null;
  detalhes?: Record<string, unknown>;
  req?: Request;
}

export function ipDaRequisicao(req?: Request): string | null {
  if (!req) return null;
  const xff = req.headers.get('x-forwarded-for');
  const ip = (xff ? xff.split(',')[0] : req.headers.get('x-real-ip')) || '';
  return ip.trim().slice(0, 64) || null;
}

/** Nunca lança exceção: uma falha de auditoria é logada, mas não derruba a operação. */
export async function registrarAuditoria(ev: EventoAuditoria): Promise<void> {
  try {
    let detalhes = ev.detalhes ? JSON.stringify(ev.detalhes) : null;
    if (detalhes && detalhes.length > 1900) detalhes = detalhes.slice(0, 1900) + '…';
    await run(
      `INSERT INTO auditoria (ocorrido_em, usuario_id, usuario_login, acao, entidade, entidade_id, detalhes, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agoraUTC(),
        ev.usuarioId ?? null,
        ev.usuarioLogin ? ev.usuarioLogin.slice(0, 100) : null,
        ev.acao,
        ev.entidade ?? null,
        ev.entidadeId !== undefined && ev.entidadeId !== null ? String(ev.entidadeId).slice(0, 100) : null,
        detalhes,
        ipDaRequisicao(ev.req),
      ]
    );
  } catch (e) {
    console.error('[auditoria] falha ao registrar evento', ev.acao, e);
  }
}
