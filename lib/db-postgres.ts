import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global.__pgPool) {
    global.__pgPool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.POSTGRES_URL?.includes('sslmode=require') ? undefined : { rejectUnauthorized: false },
    });
  }
  return global.__pgPool;
}

let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      login TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL DEFAULT 'funcionario',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispensacoes (
      id SERIAL PRIMARY KEY,
      codigo_anestesista TEXT NOT NULL,
      nome_anestesista TEXT,
      codigo_caixa TEXT NOT NULL,
      codigo_atendimento_paciente TEXT NOT NULL,
      horario_entrega TIMESTAMP NOT NULL,
      horario_devolucao TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'em_posse',
      observacoes TEXT,
      registrado_por_id INTEGER,
      registrado_por_nome TEXT,
      devolvido_por_id INTEGER,
      devolvido_por_nome TEXT,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS anestesistas (
      codigo_cracha TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      crm TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS setores (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Migração segura para bancos que já existiam antes deste recurso — o
  // Postgres suporta "ADD COLUMN IF NOT EXISTS" nativamente, então essas
  // linhas não fazem nada se as colunas já existirem (idempotente).
  await pool.query(`ALTER TABLE dispensacoes ADD COLUMN IF NOT EXISTS setor_id INTEGER;`);
  await pool.query(`ALTER TABLE dispensacoes ADD COLUMN IF NOT EXISTS setor_nome TEXT;`);
  // 0 = Não (padrão), 1 = Sim
  await pool.query(
    `ALTER TABLE dispensacoes ADD COLUMN IF NOT EXISTS kit_venoso INTEGER NOT NULL DEFAULT 0;`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS historico_edicoes (
      id SERIAL PRIMARY KEY,
      dispensacao_id INTEGER NOT NULL REFERENCES dispensacoes(id),
      campo_alterado TEXT NOT NULL,
      valor_anterior TEXT,
      valor_novo TEXT,
      editado_por_id INTEGER,
      editado_por_nome TEXT,
      alterado_em TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_disp_anestesista ON dispensacoes(codigo_anestesista);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_disp_paciente ON dispensacoes(codigo_atendimento_paciente);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_disp_caixa ON dispensacoes(codigo_caixa);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_disp_data ON dispensacoes(horario_entrega);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_disp_status ON dispensacoes(status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_disp_setor ON dispensacoes(setor_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login);`);
}

export async function getPg(): Promise<Pool> {
  if (!schemaReady) {
    schemaReady = ensureSchema();
  }
  await schemaReady;
  return getPool();
}
