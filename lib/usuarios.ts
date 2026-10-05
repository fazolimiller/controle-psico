import bcrypt from 'bcryptjs';
import { query, queryOne, run } from './db-adapter';
import { configAdminInicial, configLogin } from './config';
import { agoraUTC, formatarUTC, lerUTC } from './tempo';
import type { Papel } from './sessao-token';

const CUSTO_BCRYPT = 12;
// Hash fixo usado quando o login não existe, para que o tempo de resposta seja
// o mesmo de um login existente (evita descobrir usuários válidos por tempo).
const HASH_FICTICIO = '$2b$12$zS6NVHM9SbK2KWHqyvDH0.OHN8r.lC/yM7OngrvArTKeYa9dMzrqu';

export interface Usuario {
  id: number;
  login: string;
  nome: string;
  senha_hash: string;
  papel: Papel;
  ativo: number;
  tentativas_falhas: number;
  bloqueado_ate: string | null;
  deve_trocar_senha: number;
  sessao_versao: number;
  ultimo_login_em: string | null;
  criado_em: string;
}

export type UsuarioPublico = Pick<Usuario, 'id' | 'login' | 'nome' | 'papel' | 'ativo' | 'criado_em' | 'ultimo_login_em' | 'bloqueado_ate' | 'deve_trocar_senha'>;

const COLUNAS_PUBLICAS = 'id, login, nome, papel, ativo, criado_em, ultimo_login_em, bloqueado_ate, deve_trocar_senha';

function normalizar(u: UsuarioPublico): UsuarioPublico {
  return { ...u, id: Number(u.id), ativo: Number(u.ativo), deve_trocar_senha: Number(u.deve_trocar_senha) };
}

let adminVerificado = false;

/**
 * Cria o administrador inicial a partir do .env, somente se não houver nenhum
 * usuário. Não existe credencial padrão no código: sem ADMIN_LOGIN/ADMIN_SENHA
 * configurados, nada é criado. O admin nasce com troca de senha obrigatória.
 */
export async function ensureAdminInicial(): Promise<void> {
  if (adminVerificado) return;
  const linha = await queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM usuarios');
  if (Number(linha?.total ?? 0) > 0) {
    adminVerificado = true;
    return;
  }
  const cfg = configAdminInicial();
  if (!cfg) {
    console.warn(
      '[usuarios] Nenhum usuário cadastrado e ADMIN_LOGIN/ADMIN_SENHA não definidos no .env. ' +
        'Defina-os para criar o administrador inicial.'
    );
    return;
  }
  const hash = await bcrypt.hash(cfg.senha, CUSTO_BCRYPT);
  await run(
    `INSERT INTO usuarios (login, nome, senha_hash, papel, ativo, deve_trocar_senha, sessao_versao, tentativas_falhas, criado_em)
     VALUES (?, ?, ?, 'admin', 1, 1, 1, 0, ?)`,
    [cfg.login, cfg.nome, hash, agoraUTC()]
  );
  console.warn('[usuarios] Administrador inicial criado. Troque a senha no primeiro acesso e remova ADMIN_SENHA do .env.');
  adminVerificado = true;
}

export type ResultadoAutenticacao =
  | { ok: true; usuario: Usuario }
  | { ok: false; motivo: 'credenciais' | 'bloqueado'; minutosRestantes?: number; usuario?: Usuario };

export async function autenticar(login: string, senha: string): Promise<ResultadoAutenticacao> {
  await ensureAdminInicial();
  const cfg = configLogin();
  const usuario = await queryOne<Usuario>('SELECT * FROM usuarios WHERE login = ?', [login]);

  if (!usuario) {
    await bcrypt.compare(senha, HASH_FICTICIO);
    return { ok: false, motivo: 'credenciais' };
  }

  const agora = new Date();
  const bloqueadoAte = lerUTC(usuario.bloqueado_ate);
  if (bloqueadoAte && bloqueadoAte > agora) {
    const minutos = Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 60000);
    return { ok: false, motivo: 'bloqueado', minutosRestantes: minutos, usuario };
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

  if (!senhaCorreta || Number(usuario.ativo) !== 1) {
    if (senhaCorreta) return { ok: false, motivo: 'credenciais', usuario }; // usuário desativado
    const tentativas = Number(usuario.tentativas_falhas || 0) + 1;
    if (tentativas >= cfg.maxTentativas) {
      const ate = formatarUTC(new Date(agora.getTime() + cfg.bloqueioMinutos * 60000));
      await run('UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = ? WHERE id = ?', [ate, usuario.id]);
      return { ok: false, motivo: 'bloqueado', minutosRestantes: cfg.bloqueioMinutos, usuario };
    }
    await run('UPDATE usuarios SET tentativas_falhas = ? WHERE id = ?', [tentativas, usuario.id]);
    return { ok: false, motivo: 'credenciais', usuario };
  }

  await run('UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL, ultimo_login_em = ? WHERE id = ?', [
    agoraUTC(),
    usuario.id,
  ]);
  return {
    ok: true,
    usuario: { ...usuario, id: Number(usuario.id), sessao_versao: Number(usuario.sessao_versao) },
  };
}

export async function buscarUsuarioPorId(id: number): Promise<Usuario | undefined> {
  return queryOne<Usuario>('SELECT * FROM usuarios WHERE id = ?', [id]);
}

export async function listarUsuarios(): Promise<UsuarioPublico[]> {
  const linhas = await query<UsuarioPublico>(`SELECT ${COLUNAS_PUBLICAS} FROM usuarios ORDER BY nome ASC`);
  return linhas.map(normalizar);
}

export async function buscarUsuarioPublico(id: number): Promise<UsuarioPublico | null> {
  const u = await queryOne<UsuarioPublico>(`SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE id = ?`, [id]);
  return u ? normalizar(u) : null;
}

/** Usuário criado pelo admin sempre troca a senha no primeiro acesso. */
export async function criarUsuario(login: string, nome: string, senha: string, papel: Papel): Promise<UsuarioPublico> {
  const hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  const r = await run(
    `INSERT INTO usuarios (login, nome, senha_hash, papel, ativo, deve_trocar_senha, sessao_versao, tentativas_falhas, criado_em)
     VALUES (?, ?, ?, ?, 1, 1, 1, 0, ?)`,
    [login, nome, hash, papel, agoraUTC()],
    { returningId: true }
  );
  return (await buscarUsuarioPublico(r.lastInsertRowid))!;
}

export async function contarAdminsAtivos(excetoId?: number): Promise<number> {
  const linha = excetoId
    ? await queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND id <> ?", [excetoId])
    : await queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'admin' AND ativo = 1");
  return Number(linha?.total ?? 0);
}

/**
 * Atualiza dados do usuário. Mudança de papel, status ou senha incrementa a
 * versão de sessão — o usuário é desconectado imediatamente em todos os
 * navegadores. Senha redefinida pelo admin obriga nova troca no próximo acesso.
 */
export async function atualizarUsuario(
  id: number,
  dados: { nome?: string; papel?: Papel; ativo?: boolean; senha?: string; desbloquear?: boolean }
): Promise<UsuarioPublico | null> {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  let invalidarSessao = false;

  if (dados.nome !== undefined) {
    sets.push('nome = ?');
    params.push(dados.nome);
  }
  if (dados.papel !== undefined) {
    sets.push('papel = ?');
    params.push(dados.papel);
    invalidarSessao = true;
  }
  if (dados.ativo !== undefined) {
    sets.push('ativo = ?');
    params.push(dados.ativo ? 1 : 0);
    invalidarSessao = true;
  }
  if (dados.senha) {
    sets.push('senha_hash = ?', 'deve_trocar_senha = 1', 'senha_alterada_em = ?');
    params.push(await bcrypt.hash(dados.senha, CUSTO_BCRYPT), agoraUTC());
    invalidarSessao = true;
  }
  if (dados.desbloquear) {
    sets.push('bloqueado_ate = NULL', 'tentativas_falhas = 0');
  }
  if (invalidarSessao) sets.push('sessao_versao = sessao_versao + 1');

  if (sets.length > 0) {
    params.push(id);
    await run(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return buscarUsuarioPublico(id);
}

/** Troca de senha pelo próprio usuário. Devolve a nova versão de sessão. */
export async function trocarPropriaSenha(id: number, novaSenha: string): Promise<number> {
  const hash = await bcrypt.hash(novaSenha, CUSTO_BCRYPT);
  await run(
    `UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 0, senha_alterada_em = ?,
       sessao_versao = sessao_versao + 1 WHERE id = ?`,
    [hash, agoraUTC(), id]
  );
  const u = await queryOne<{ sessao_versao: number }>('SELECT sessao_versao FROM usuarios WHERE id = ?', [id]);
  return Number(u?.sessao_versao ?? 0);
}

export async function conferirSenha(id: number, senha: string): Promise<boolean> {
  const u = await queryOne<{ senha_hash: string }>('SELECT senha_hash FROM usuarios WHERE id = ?', [id]);
  if (!u) return false;
  return bcrypt.compare(senha, u.senha_hash);
}
