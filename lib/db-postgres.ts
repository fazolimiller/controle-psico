import { Pool, types } from 'pg';
import { configPostgres } from './config';

// Devolve TIMESTAMP como texto "YYYY-MM-DD HH:MM:SS" (UTC), em vez de Date.
// Sem isso, o driver interpreta o horário no fuso do servidor Node e desloca
// os valores em 3 horas quando o servidor está configurado para Brasília.
types.setTypeParser(1114, (v: string) => v.slice(0, 19));
// COUNT/SUM chegam como texto no PostgreSQL; padroniza para número, como no Oracle.
types.setTypeParser(20, (v: string) => Number(v));
types.setTypeParser(1700, (v: string) => Number(v));

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global.__pgPool) {
    // SSL é definido pela própria connection string (ex.: ?sslmode=require).
    global.__pgPool = new Pool({ connectionString: configPostgres().connectionString, max: 10 });
  }
  return global.__pgPool;
}

let schemaReady: Promise<void> | null = null;

const UTC_AGORA = "(NOW() AT TIME ZONE 'UTC')";

async function ensureSchema(): Promise<void> {
  const pool = getPool();
  const q = (sql: string) => pool.query(sql);

  await q(`CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    login TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT 'funcionario',
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NOT NULL DEFAULT ${UTC_AGORA}
  );`);
  await q(`CREATE TABLE IF NOT EXISTS dispensacoes (
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
    criado_em TIMESTAMP NOT NULL DEFAULT ${UTC_AGORA},
    atualizado_em TIMESTAMP NOT NULL DEFAULT ${UTC_AGORA}
  );`);
  await q(`CREATE TABLE IF NOT EXISTS anestesistas (
    codigo_cracha TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    crm TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NOT NULL DEFAULT ${UTC_AGORA}
  );`);
  await q(`CREATE TABLE IF NOT EXISTS setores (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NOT NULL DEFAULT ${UTC_AGORA}
  );`);
  await q(`CREATE TABLE IF NOT EXISTS historico_edicoes (
    id SERIAL PRIMARY KEY,
    dispensacao_id INTEGER NOT NULL REFERENCES dispensacoes(id),
    campo_alterado TEXT NOT NULL,
    valor_anterior TEXT,
    valor_novo TEXT,
    editado_por_id INTEGER,
    editado_por_nome TEXT,
    alterado_em TIMESTAMP NOT NULL DEFAULT ${UTC_AGORA}
  );`);
  await q(`CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    ocorrido_em TIMESTAMP NOT NULL,
    usuario_id INTEGER,
    usuario_login TEXT,
    acao TEXT NOT NULL,
    entidade TEXT,
    entidade_id TEXT,
    detalhes TEXT,
    ip TEXT
  );`);

  // Migrações idempotentes para bancos criados por versões anteriores.
  const colunas: [string, string, string][] = [
    ['dispensacoes', 'setor_id', 'INTEGER'],
    ['dispensacoes', 'setor_nome', 'TEXT'],
    ['dispensacoes', 'kit_venoso', 'INTEGER NOT NULL DEFAULT 0'],
    ['dispensacoes', 'anestesista_devolucao_cracha', 'TEXT'],
    ['dispensacoes', 'anestesista_devolucao_nome', 'TEXT'],
    ['dispensacoes', 'excluido_em', 'TIMESTAMP'],
    ['dispensacoes', 'excluido_por_id', 'INTEGER'],
    ['dispensacoes', 'excluido_por_nome', 'TEXT'],
    ['dispensacoes', 'motivo_exclusao', 'TEXT'],
    ['anestesistas', 'excluido_em', 'TIMESTAMP'],
    ['anestesistas', 'excluido_por_nome', 'TEXT'],
    ['setores', 'excluido_em', 'TIMESTAMP'],
    ['setores', 'excluido_por_nome', 'TEXT'],
    ['usuarios', 'tentativas_falhas', 'INTEGER NOT NULL DEFAULT 0'],
    ['usuarios', 'bloqueado_ate', 'TIMESTAMP'],
    ['usuarios', 'deve_trocar_senha', 'INTEGER NOT NULL DEFAULT 0'],
    ['usuarios', 'sessao_versao', 'INTEGER NOT NULL DEFAULT 1'],
    ['usuarios', 'senha_alterada_em', 'TIMESTAMP'],
    ['usuarios', 'ultimo_login_em', 'TIMESTAMP'],
  ];
  for (const [tabela, coluna, def] of colunas) {
    await q(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS ${coluna} ${def};`);
  }

  const indices = [
    'idx_disp_anestesista ON dispensacoes(codigo_anestesista)',
    'idx_disp_paciente ON dispensacoes(codigo_atendimento_paciente)',
    'idx_disp_caixa ON dispensacoes(codigo_caixa)',
    'idx_disp_data ON dispensacoes(horario_entrega)',
    'idx_disp_status ON dispensacoes(status)',
    'idx_disp_setor ON dispensacoes(setor_id)',
    'idx_hist_disp ON historico_edicoes(dispensacao_id)',
    'idx_aud_data ON auditoria(ocorrido_em)',
  ];
  for (const idx of indices) await q(`CREATE INDEX IF NOT EXISTS ${idx};`);
}

export async function getPg(): Promise<Pool> {
  if (!schemaReady) {
    schemaReady = ensureSchema().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  await schemaReady;
  return getPool();
}
