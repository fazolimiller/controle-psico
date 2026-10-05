// Configuração da aplicação, lida exclusivamente de variáveis de ambiente.
//
// Regra de segurança: nenhum valor sensível (segredos, senhas, strings de
// conexão) tem valor padrão no código. Se uma variável obrigatória estiver
// ausente, a aplicação falha com uma mensagem clara em vez de cair num padrão
// inseguro. Os valores ficam no arquivo .env do servidor (fora do controle de
// versão) ou nas variáveis de ambiente do serviço.
//
// Este módulo não importa nada de Node além de process.env, para poder ser
// usado também no middleware (Edge Runtime).

export type Dialeto = 'sqlite' | 'postgres' | 'oracle';

export class ErroConfiguracao extends Error {
  constructor(mensagem: string) {
    super(`[configuração] ${mensagem}`);
    this.name = 'ErroConfiguracao';
  }
}

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || !valor.trim()) {
    throw new ErroConfiguracao(`A variável de ambiente ${nome} é obrigatória e não foi definida. Consulte o .env.example.`);
  }
  return valor.trim();
}

function inteiro(nome: string, padrao: number, minimo: number, maximo: number): number {
  const bruto = process.env[nome];
  if (!bruto) return padrao;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < minimo || n > maximo) {
    throw new ErroConfiguracao(`${nome} deve ser um número inteiro entre ${minimo} e ${maximo}.`);
  }
  return n;
}

/** Segredo usado para assinar o cookie de sessão (HMAC-SHA256). Mínimo de 32 caracteres. */
export function segredoSessao(): string {
  const segredo = obrigatoria('SESSION_SECRET');
  if (segredo.length < 32) {
    throw new ErroConfiguracao('SESSION_SECRET deve ter pelo menos 32 caracteres. Gere com: openssl rand -hex 32');
  }
  return segredo;
}

/** Banco de dados em uso. Em produção, SQLite não é permitido. */
export function dialeto(): Dialeto {
  const bruto = (process.env.DB_CLIENT || '').trim().toLowerCase();
  let d: Dialeto;
  if (bruto === 'oracle' || bruto === 'postgres' || bruto === 'sqlite') {
    d = bruto;
  } else if (bruto) {
    throw new ErroConfiguracao('DB_CLIENT deve ser "oracle", "postgres" ou "sqlite".');
  } else {
    // Compatibilidade com a versão anterior, que escolhia o banco pela presença de POSTGRES_URL.
    d = process.env.POSTGRES_URL ? 'postgres' : 'sqlite';
  }
  if (d === 'sqlite' && process.env.NODE_ENV === 'production' && process.env.PERMITIR_SQLITE_EM_PRODUCAO !== 'sim') {
    throw new ErroConfiguracao('SQLite é apenas para desenvolvimento local. Em produção, defina DB_CLIENT=oracle (ou postgres).');
  }
  return d;
}

export function configPostgres() {
  return { connectionString: obrigatoria('POSTGRES_URL') };
}

export function configOracle() {
  return {
    user: obrigatoria('ORACLE_USER'),
    password: obrigatoria('ORACLE_PASSWORD'),
    connectString: obrigatoria('ORACLE_CONNECT_STRING'),
    // Opcional: esquema dono das tabelas, quando a aplicação conecta com um
    // usuário diferente (recomendado: usuário de aplicação sem privilégio de DDL/DELETE).
    schema: (process.env.ORACLE_SCHEMA || '').trim() || null,
    poolMin: inteiro('ORACLE_POOL_MIN', 1, 0, 50),
    poolMax: inteiro('ORACLE_POOL_MAX', 10, 1, 100),
  };
}

/** Parâmetros de sessão e de login (não sensíveis, por isso têm padrão). */
export function configSessao() {
  return {
    inatividadeMinutos: inteiro('SESSION_IDLE_MINUTES', 30, 5, 720),
    duracaoMaximaHoras: inteiro('SESSION_MAX_HOURS', 12, 1, 24),
    // Cookie "Secure" exige HTTPS. Padrão: ligado em produção. Só desligue se a
    // TI servir a aplicação por HTTP na rede interna (não recomendado).
    cookieSeguro:
      process.env.COOKIE_SECURE !== undefined
        ? process.env.COOKIE_SECURE === 'true'
        : process.env.NODE_ENV === 'production',
  };
}

export function configLogin() {
  return {
    maxTentativas: inteiro('LOGIN_MAX_TENTATIVAS', 5, 3, 20),
    bloqueioMinutos: inteiro('LOGIN_BLOQUEIO_MINUTOS', 15, 1, 1440),
  };
}

/**
 * Administrador inicial: criado apenas quando a tabela de usuários está vazia.
 * Não há valor padrão. O usuário é criado com troca de senha obrigatória no
 * primeiro acesso; depois disso, ADMIN_SENHA pode (e deve) ser removida do .env.
 */
export function configAdminInicial(): { login: string; senha: string; nome: string } | null {
  const login = (process.env.ADMIN_LOGIN || '').trim();
  const senha = process.env.ADMIN_SENHA || '';
  const nome = (process.env.ADMIN_NOME || '').trim() || 'Administrador';
  if (!login || !senha) return null;
  return { login, senha, nome };
}
