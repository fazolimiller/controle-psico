// SQLite — USO EXCLUSIVO EM DESENVOLVIMENTO LOCAL (bloqueado em produção por lib/config.ts).
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'farmacia.db');

declare global {
  // eslint-disable-next-line no-var
  var __db: DatabaseSync | undefined;
}

function adicionarColunaSeFaltar(db: DatabaseSync, tabela: string, coluna: string, definicao: string) {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[];
  if (!colunas.some((c) => c.name === coluna)) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao};`);
  }
}

function initDb(): DatabaseSync {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL DEFAULT 'funcionario',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS dispensacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_anestesista TEXT NOT NULL,
      nome_anestesista TEXT,
      codigo_caixa TEXT NOT NULL,
      codigo_atendimento_paciente TEXT NOT NULL,
      horario_entrega TEXT NOT NULL,
      horario_devolucao TEXT,
      status TEXT NOT NULL DEFAULT 'em_posse',
      observacoes TEXT,
      registrado_por_id INTEGER,
      registrado_por_nome TEXT,
      devolvido_por_id INTEGER,
      devolvido_por_nome TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS anestesistas (
      codigo_cracha TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      crm TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS setores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS historico_edicoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispensacao_id INTEGER NOT NULL,
      campo_alterado TEXT NOT NULL,
      valor_anterior TEXT,
      valor_novo TEXT,
      editado_por_id INTEGER,
      editado_por_nome TEXT,
      alterado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (dispensacao_id) REFERENCES dispensacoes(id)
    );
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ocorrido_em TEXT NOT NULL,
      usuario_id INTEGER,
      usuario_login TEXT,
      acao TEXT NOT NULL,
      entidade TEXT,
      entidade_id TEXT,
      detalhes TEXT,
      ip TEXT
    );
  `);

  // Migrações idempotentes para bancos criados por versões anteriores.
  adicionarColunaSeFaltar(db, 'dispensacoes', 'setor_id', 'INTEGER');
  adicionarColunaSeFaltar(db, 'dispensacoes', 'setor_nome', 'TEXT');
  adicionarColunaSeFaltar(db, 'dispensacoes', 'kit_venoso', 'INTEGER NOT NULL DEFAULT 0');
  adicionarColunaSeFaltar(db, 'dispensacoes', 'anestesista_devolucao_cracha', 'TEXT');
  adicionarColunaSeFaltar(db, 'dispensacoes', 'anestesista_devolucao_nome', 'TEXT');
  // Exclusão lógica (soft delete)
  adicionarColunaSeFaltar(db, 'dispensacoes', 'excluido_em', 'TEXT');
  adicionarColunaSeFaltar(db, 'dispensacoes', 'excluido_por_id', 'INTEGER');
  adicionarColunaSeFaltar(db, 'dispensacoes', 'excluido_por_nome', 'TEXT');
  adicionarColunaSeFaltar(db, 'dispensacoes', 'motivo_exclusao', 'TEXT');
  adicionarColunaSeFaltar(db, 'anestesistas', 'excluido_em', 'TEXT');
  adicionarColunaSeFaltar(db, 'anestesistas', 'excluido_por_nome', 'TEXT');
  adicionarColunaSeFaltar(db, 'setores', 'excluido_em', 'TEXT');
  adicionarColunaSeFaltar(db, 'setores', 'excluido_por_nome', 'TEXT');
  // Segurança de login e sessão
  adicionarColunaSeFaltar(db, 'usuarios', 'tentativas_falhas', 'INTEGER NOT NULL DEFAULT 0');
  adicionarColunaSeFaltar(db, 'usuarios', 'bloqueado_ate', 'TEXT');
  adicionarColunaSeFaltar(db, 'usuarios', 'deve_trocar_senha', 'INTEGER NOT NULL DEFAULT 0');
  adicionarColunaSeFaltar(db, 'usuarios', 'sessao_versao', 'INTEGER NOT NULL DEFAULT 1');
  adicionarColunaSeFaltar(db, 'usuarios', 'senha_alterada_em', 'TEXT');
  adicionarColunaSeFaltar(db, 'usuarios', 'ultimo_login_em', 'TEXT');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_disp_anestesista ON dispensacoes(codigo_anestesista);
    CREATE INDEX IF NOT EXISTS idx_disp_paciente ON dispensacoes(codigo_atendimento_paciente);
    CREATE INDEX IF NOT EXISTS idx_disp_caixa ON dispensacoes(codigo_caixa);
    CREATE INDEX IF NOT EXISTS idx_disp_data ON dispensacoes(horario_entrega);
    CREATE INDEX IF NOT EXISTS idx_disp_status ON dispensacoes(status);
    CREATE INDEX IF NOT EXISTS idx_disp_setor ON dispensacoes(setor_id);
    CREATE INDEX IF NOT EXISTS idx_hist_disp ON historico_edicoes(dispensacao_id);
    CREATE INDEX IF NOT EXISTS idx_aud_data ON auditoria(ocorrido_em);
  `);

  return db;
}

export function getDb(): DatabaseSync {
  if (!global.__db) global.__db = initDb();
  return global.__db;
}
