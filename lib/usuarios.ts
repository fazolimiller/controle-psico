import bcrypt from 'bcryptjs';
import { query, run } from './db-adapter';

export interface Usuario {
  id: number;
  login: string;
  nome: string;
  senha_hash: string;
  papel: 'admin' | 'funcionario';
  ativo: number;
  criado_em: string;
}

export type UsuarioPublico = Omit<Usuario, 'senha_hash'>;

let adminEnsured = false;

// Garante que existe um admin inicial, criado a partir de variáveis de ambiente.
// Isso evita a necessidade de qualquer configuração manual de banco no primeiro deploy.
export async function ensureAdminInicial(): Promise<void> {
  if (adminEnsured) return;

  const existentes = await query<{ total: number }>('SELECT COUNT(*) as total FROM usuarios');
  const total = Number(existentes[0]?.total ?? 0);

  if (total === 0) {
    const login = process.env.ADMIN_LOGIN || 'admin';
    const senha = process.env.ADMIN_SENHA || 'admin123';
    const nome = process.env.ADMIN_NOME || 'Administrador';
    const hash = await bcrypt.hash(senha, 10);

    await run(
      `INSERT INTO usuarios (login, nome, senha_hash, papel, ativo) VALUES (?, ?, ?, 'admin', 1)`,
      [login, nome, hash]
    );
  }

  adminEnsured = true;
}

export async function autenticar(login: string, senha: string): Promise<UsuarioPublico | null> {
  await ensureAdminInicial();

  const usuarios = await query<Usuario>('SELECT * FROM usuarios WHERE login = ? AND ativo = 1', [login]);
  const usuario = usuarios[0];
  if (!usuario) return null;

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaCorreta) return null;

  const { senha_hash: _senha_hash, ...publico } = usuario;
  void _senha_hash;
  return publico;
}

export async function listarUsuarios(): Promise<UsuarioPublico[]> {
  const usuarios = await query<Usuario>('SELECT * FROM usuarios ORDER BY nome ASC');
  return usuarios.map(({ senha_hash: _senha_hash, ...publico }) => {
    void _senha_hash;
    return publico;
  });
}

export async function criarUsuario(
  login: string,
  nome: string,
  senha: string,
  papel: 'admin' | 'funcionario'
): Promise<UsuarioPublico> {
  const hash = await bcrypt.hash(senha, 10);
  const result = await run(
    `INSERT INTO usuarios (login, nome, senha_hash, papel, ativo) VALUES (?, ?, ?, ?, 1)`,
    [login, nome, hash, papel],
    { returningId: true }
  );
  const novo = await query<Usuario>('SELECT * FROM usuarios WHERE id = ?', [Number(result.lastInsertRowid)]);
  const { senha_hash: _senha_hash, ...publico } = novo[0];
  void _senha_hash;
  return publico;
}

export async function atualizarUsuario(
  id: number,
  dados: { nome?: string; papel?: 'admin' | 'funcionario'; ativo?: boolean; senha?: string }
): Promise<UsuarioPublico | null> {
  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (dados.nome !== undefined) {
    updates.push('nome = ?');
    params.push(dados.nome);
  }
  if (dados.papel !== undefined) {
    updates.push('papel = ?');
    params.push(dados.papel);
  }
  if (dados.ativo !== undefined) {
    updates.push('ativo = ?');
    params.push(dados.ativo ? 1 : 0);
  }
  if (dados.senha) {
    const hash = await bcrypt.hash(dados.senha, 10);
    updates.push('senha_hash = ?');
    params.push(hash);
  }

  if (updates.length === 0) {
    const atual = await query<Usuario>('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!atual[0]) return null;
    const { senha_hash: _senha_hash, ...publico } = atual[0];
    void _senha_hash;
    return publico;
  }

  params.push(id);
  await run(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, params);

  const atualizado = await query<Usuario>('SELECT * FROM usuarios WHERE id = ?', [id]);
  if (!atualizado[0]) return null;
  const { senha_hash: _senha_hash, ...publico } = atualizado[0];
  void _senha_hash;
  return publico;
}
