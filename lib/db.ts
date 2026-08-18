import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'farmacia.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

declare global {
  // eslint-disable-next-line no-var
  var __db: DatabaseSync | undefined;
}

function initDb(): DatabaseSync {
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
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  db.exec(`
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
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS anestesistas (
      codigo_cracha TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      crm TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS setores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migração segura: adiciona as colunas de setor em bancos que já existiam
  // antes desse recurso (SQLite não suporta "ADD COLUMN IF NOT EXISTS", então
  // checamos manualmente quais colunas já existem antes de tentar criar).
  const colunasDispensacoes = db.prepare("PRAGMA table_info(dispensacoes)").all() as { name: string }[];
  const nomesColunas = new Set(colunasDispensacoes.map((c) => c.name));
  if (!nomesColunas.has('setor_id')) {
    db.exec('ALTER TABLE dispensacoes ADD COLUMN setor_id INTEGER;');
  }
  if (!nomesColunas.has('setor_nome')) {
    db.exec('ALTER TABLE dispensacoes ADD COLUMN setor_nome TEXT;');
  }
  if (!nomesColunas.has('kit_venoso')) {
    // 0 = Não (padrão), 1 = Sim
    db.exec("ALTER TABLE dispensacoes ADD COLUMN kit_venoso INTEGER NOT NULL DEFAULT 0;");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS historico_edicoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispensacao_id INTEGER NOT NULL,
      campo_alterado TEXT NOT NULL,
      valor_anterior TEXT,
      valor_novo TEXT,
      editado_por_id INTEGER,
      editado_por_nome TEXT,
      alterado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (dispensacao_id) REFERENCES dispensacoes(id)
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_disp_anestesista ON dispensacoes(codigo_anestesista);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_disp_paciente ON dispensacoes(codigo_atendimento_paciente);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_disp_caixa ON dispensacoes(codigo_caixa);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_disp_data ON dispensacoes(horario_entrega);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_disp_status ON dispensacoes(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_disp_setor ON dispensacoes(setor_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login);`);

  return db;
}

export function getDb(): DatabaseSync {
  if (!global.__db) {
    global.__db = initDb();
  }
  return global.__db;
}
