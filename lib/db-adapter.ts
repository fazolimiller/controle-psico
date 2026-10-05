// Camada única de acesso a dados.
//
// Todas as consultas da aplicação passam por aqui e são escritas UMA vez, em
// SQL portátil com placeholders "?". A camada converte os placeholders para o
// formato de cada banco ($1 no PostgreSQL, :1 no Oracle) e os valores SEMPRE
// trafegam como parâmetros vinculados (bind variables) — nunca concatenados ao
// texto do SQL. Isso é o que impede SQL Injection.
//
// Regras para quem for manter o código:
//  - Nunca interpolar valores vindos do usuário no SQL. Use "?" e o array de parâmetros.
//  - Nomes de colunas dinâmicos (ex.: UPDATE com campos variáveis) só podem vir
//    de listas fixas definidas no código (whitelist).
//  - Não usar funções de data do banco (NOW(), SYSDATE...): os horários são
//    gerados pela aplicação em UTC (ver lib/tempo.ts).

import { dialeto, type Dialeto } from './config';

export type Parametro = string | number | null;

/**
 * Troca cada "?" fora de literais de texto pelo marcador do banco.
 * Literais entre aspas simples (incluindo aspas duplicadas '') são preservados.
 */
export function converterPlaceholders(sql: string, marcador: (n: number) => string): { sql: string; total: number } {
  let saida = '';
  let n = 0;
  let dentroDeTexto = false;
  for (const ch of sql) {
    if (ch === "'") {
      dentroDeTexto = !dentroDeTexto;
      saida += ch;
    } else if (ch === '?' && !dentroDeTexto) {
      saida += marcador(++n);
    } else {
      saida += ch;
    }
  }
  return { sql: saida, total: n };
}

function conferirParametros(total: number, params: Parametro[]) {
  if (total !== params.length) {
    throw new Error(`Consulta com ${total} parâmetro(s) "?" recebeu ${params.length} valor(es).`);
  }
  for (const p of params) {
    if (p !== null && typeof p !== 'string' && typeof p !== 'number') {
      throw new Error('Parâmetro de consulta com tipo não suportado.');
    }
  }
}

export async function query<T = Record<string, unknown>>(sql: string, params: Parametro[] = []): Promise<T[]> {
  const d = dialeto();
  if (d === 'postgres') {
    const { sql: pgSql, total } = converterPlaceholders(sql, (n) => `$${n}`);
    conferirParametros(total, params);
    const { getPg } = await import('./db-postgres');
    const pool = await getPg();
    const result = await pool.query(pgSql, params);
    return result.rows as T[];
  }
  if (d === 'oracle') {
    const { sql: oraSql, total } = converterPlaceholders(sql, (n) => `:${n}`);
    conferirParametros(total, params);
    const { executarOracle } = await import('./db-oracle');
    const r = await executarOracle(oraSql, params);
    return r.linhas as T[];
  }
  const { total } = converterPlaceholders(sql, () => '?');
  conferirParametros(total, params);
  const { getDb } = await import('./db');
  return getDb().prepare(sql).all(...params) as T[];
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: Parametro[] = []): Promise<T | undefined> {
  const linhas = await query<T>(sql, params);
  return linhas[0];
}

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

/** INSERT/UPDATE. Com returningId, devolve o id gerado (coluna "id"). */
export async function run(
  sql: string,
  params: Parametro[] = [],
  options: { returningId?: boolean } = {}
): Promise<RunResult> {
  const d = dialeto();
  if (d === 'postgres') {
    const convertido = converterPlaceholders(sql, (n) => `$${n}`);
    conferirParametros(convertido.total, params);
    const pgSql = options.returningId ? `${convertido.sql} RETURNING id` : convertido.sql;
    const { getPg } = await import('./db-postgres');
    const pool = await getPg();
    const result = await pool.query(pgSql, params);
    return { lastInsertRowid: Number(result.rows[0]?.id ?? 0), changes: result.rowCount ?? 0 };
  }
  if (d === 'oracle') {
    const { sql: oraSql, total } = converterPlaceholders(sql, (n) => `:${n}`);
    conferirParametros(total, params);
    const { executarOracle } = await import('./db-oracle');
    const r = await executarOracle(oraSql, params, { returningId: options.returningId });
    return { lastInsertRowid: r.idGerado ?? 0, changes: r.linhasAfetadas };
  }
  const { total } = converterPlaceholders(sql, () => '?');
  conferirParametros(total, params);
  const { getDb } = await import('./db');
  const result = getDb().prepare(sql).run(...params);
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: Number(result.changes) };
}

/**
 * Cláusula de limite de linhas. O valor é forçado para inteiro positivo antes
 * de entrar no SQL (não é texto do usuário).
 */
export function limitar(n: number): string {
  const lim = Math.max(1, Math.min(10000, Math.floor(Number(n) || 1)));
  return dialeto() === 'sqlite' ? `LIMIT ${lim}` : `FETCH FIRST ${lim} ROWS ONLY`;
}

/** Escapa curingas de LIKE. Use sempre com: coluna LIKE ? ESCAPE '\' */
export function padraoLike(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function dialetoAtual(): Dialeto {
  return dialeto();
}
