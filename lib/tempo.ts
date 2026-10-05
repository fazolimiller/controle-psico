// Utilitários de data/hora do lado do servidor.
//
// Convenção única para os três bancos (SQLite, PostgreSQL e Oracle): todos os
// horários são gravados em UTC como texto "YYYY-MM-DD HH:MM:SS", gerados pela
// aplicação — nunca por funções do banco (NOW(), SYSDATE...), que dependem do
// fuso configurado no servidor e variam de banco para banco.

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

function dois(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatarUTC(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())} ` +
    `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}:${dois(d.getUTCSeconds())}`
  );
}

export function agoraUTC(): string {
  return formatarUTC(new Date());
}

/** Lê "YYYY-MM-DD HH:MM:SS" (UTC) ou ISO 8601 e devolve Date, ou null se inválido. */
export function lerUTC(valor: unknown): Date | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  const s = String(valor).trim();
  let iso = s.includes('T') ? s : s.replace(' ', 'T');
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso)) iso += 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Normaliza um horário recebido do cliente para o formato de gravação, ou null se inválido. */
export function normalizarHorario(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const s = valor.trim();
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([zZ]|[+-]\d{2}:?\d{2})?$/.test(s)) return null;
  const d = lerUTC(s);
  return d ? formatarUTC(d) : null;
}

export function dataValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !RE_DATA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

/**
 * Converte um dia civil de Brasília (YYYY-MM-DD) no intervalo UTC
 * [início, fim) correspondente. O Brasil está fixo em UTC-3 desde 2019.
 * Comparar a coluna com um intervalo (em vez de aplicar funções de data sobre
 * ela) funciona igual nos três bancos e aproveita o índice.
 */
export function intervaloDiaBrasil(dataISO: string): { inicio: string; fim: string } {
  const inicio = new Date(`${dataISO}T03:00:00Z`);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio: formatarUTC(inicio), fim: formatarUTC(fim) };
}
