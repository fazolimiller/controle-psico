// Oracle Database (padrão da instituição).
//
// Usa o driver oficial node-oracledb em modo "thin" (JavaScript puro): não
// exige Oracle Instant Client instalado no servidor. Requer Oracle 12.1 ou
// superior (colunas IDENTITY e FETCH FIRST).
//
// O esquema NÃO é criado pela aplicação: as tabelas são criadas pelo DBA com
// os scripts de db/oracle/. Assim o usuário de conexão da aplicação pode
// operar sem privilégio de DDL nem de DELETE.
//
// Convenções de sessão aplicadas a cada conexão do pool:
//  - TIME_ZONE = 'UTC'
//  - NLS_TIMESTAMP_FORMAT / NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'
// Com isso, os horários gravados e lidos como texto ficam idênticos aos do
// PostgreSQL e do SQLite (ver lib/tempo.ts).

import oracledb from 'oracledb';
import { configOracle } from './config';
import type { Parametro } from './db-adapter';

declare global {
  // eslint-disable-next-line no-var
  var __oraclePool: Promise<oracledb.Pool> | undefined;
}

const SQL_SESSAO =
  "ALTER SESSION SET TIME_ZONE = 'UTC' " +
  "NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS' " +
  "NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS'";

const TIPOS_DATA = new Set<unknown>([
  oracledb.DB_TYPE_DATE,
  oracledb.DB_TYPE_TIMESTAMP,
  oracledb.DB_TYPE_TIMESTAMP_LTZ,
  oracledb.DB_TYPE_TIMESTAMP_TZ,
]);

function configurarDriver() {
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = true;
  // Datas e textos longos chegam como string, no mesmo formato dos outros bancos.
  oracledb.fetchTypeHandler = (meta) => {
    if (TIPOS_DATA.has(meta.dbType)) return { type: oracledb.STRING };
    if (meta.dbType === oracledb.DB_TYPE_CLOB || meta.dbType === oracledb.DB_TYPE_NCLOB) {
      return { type: oracledb.STRING };
    }
    return undefined;
  };
}

function criarPool(): Promise<oracledb.Pool> {
  configurarDriver();
  const cfg = configOracle();
  const sqlSessao = cfg.schema
    ? // O nome do esquema vem da configuração do servidor (não do usuário) e é validado.
      (() => {
        if (!/^[A-Za-z][A-Za-z0-9_$#]{0,127}$/.test(cfg.schema!)) {
          throw new Error('ORACLE_SCHEMA contém caracteres inválidos.');
        }
        return `${SQL_SESSAO} CURRENT_SCHEMA = ${cfg.schema}`;
      })()
    : SQL_SESSAO;

  return oracledb.createPool({
    user: cfg.user,
    password: cfg.password,
    connectString: cfg.connectString,
    poolMin: cfg.poolMin,
    poolMax: cfg.poolMax,
    poolIncrement: 1,
    sessionCallback: (conexao: oracledb.Connection, _tag: string, pronto: (err?: Error) => void) => {
      conexao.execute(sqlSessao).then(
        () => pronto(),
        (err: Error) => pronto(err)
      );
    },
  });
}

function getPool(): Promise<oracledb.Pool> {
  if (!global.__oraclePool) {
    global.__oraclePool = criarPool().catch((e) => {
      global.__oraclePool = undefined;
      throw e;
    });
  }
  return global.__oraclePool;
}

/** O Oracle devolve nomes de coluna em maiúsculas; a aplicação usa minúsculas. */
function chavesMinusculas(linha: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(linha)) saida[k.toLowerCase()] = v;
  return saida;
}

export async function executarOracle(
  sql: string,
  params: Parametro[],
  opcoes: { returningId?: boolean } = {}
): Promise<{ linhas: Record<string, unknown>[]; linhasAfetadas: number; idGerado: number | null }> {
  const pool = await getPool();
  const conexao = await pool.getConnection();
  try {
    const binds: (Parametro | oracledb.BindParameter)[] = [...params];
    let sqlFinal = sql;
    if (opcoes.returningId) {
      sqlFinal += ` RETURNING id INTO :${params.length + 1}`;
      binds.push({ dir: oracledb.BIND_OUT, type: oracledb.NUMBER });
    }
    const r = await conexao.execute<Record<string, unknown>>(sqlFinal, binds as oracledb.BindParameters);
    let idGerado: number | null = null;
    if (opcoes.returningId && Array.isArray(r.outBinds)) {
      const valor = (r.outBinds as unknown[])[0];
      idGerado = Number(Array.isArray(valor) ? valor[0] : valor);
    }
    return {
      linhas: (r.rows ?? []).map(chavesMinusculas),
      linhasAfetadas: r.rowsAffected ?? 0,
      idGerado,
    };
  } finally {
    await conexao.close();
  }
}
