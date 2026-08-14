import { Dispensacao } from './types';

const usePostgres = !!process.env.POSTGRES_URL;

// Converte placeholders estilo SQLite (?) para estilo Postgres ($1, $2...)
function toPgQuery(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

export async function query<T = Record<string, unknown>>(
  sqliteQuery: string,
  params: (string | number | null)[] = []
): Promise<T[]> {
  if (usePostgres) {
    const { getPg } = await import('./db-postgres');
    const pool = await getPg();
    const result = await pool.query(toPgQuery(sqliteQuery), params);
    return result.rows as T[];
  } else {
    const { getDb } = await import('./db');
    const db = getDb();
    const stmt = db.prepare(sqliteQuery);
    return stmt.all(...params) as T[];
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sqliteQuery: string,
  params: (string | number | null)[] = []
): Promise<T | undefined> {
  const rows = await query<T>(sqliteQuery, params);
  return rows[0];
}

export interface RunResult {
  lastInsertRowid: number | bigint;
  changes: number | bigint;
}

export async function run(
  sqliteQuery: string,
  params: (string | number | null)[] = []
): Promise<RunResult> {
  if (usePostgres) {
    const { getPg } = await import('./db-postgres');
    const pool = await getPg();
    let pgQuery = toPgQuery(sqliteQuery);
    const isInsert = /^\s*INSERT/i.test(pgQuery);
    if (isInsert && !/RETURNING/i.test(pgQuery)) {
      pgQuery += ' RETURNING id';
    }
    const result = await pool.query(pgQuery, params);
    return {
      lastInsertRowid: result.rows[0]?.id ?? 0,
      changes: result.rowCount ?? 0,
    };
  } else {
    const { getDb } = await import('./db');
    const db = getDb();
    const stmt = db.prepare(sqliteQuery);
    const result = stmt.run(...params);
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  }
}

export function nowExpr(): string {
  return usePostgres ? 'NOW()' : "datetime('now', 'localtime')";
}

export function isUsingPostgres(): boolean {
  return usePostgres;
}

export type { Dispensacao };
