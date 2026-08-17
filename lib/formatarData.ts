// Utilitários de data/hora para exibição em horário do Brasil (GMT-3).
//
// O banco de dados guarda os horários em UTC (padrão para bancos como Postgres;
// o SQLite local também trata como UTC quando vem do relógio do servidor).
// Essas funções convertem para o fuso de São Paulo na hora de exibir.

const FUSO_BRASIL = 'America/Sao_Paulo';

/**
 * Recebe um valor de data/hora do banco (string ISO, ou "YYYY-MM-DD HH:mm:ss")
 * e devolve um objeto Date válido, tratando como UTC quando não há informação
 * explícita de fuso.
 */
function paraDate(valor: string | null): Date | null {
  if (!valor) return null;
  // SQLite grava "YYYY-MM-DD HH:mm:ss" sem fuso — tratamos como UTC explicitamente.
  const normalizado = valor.includes('T') ? valor : valor.replace(' ', 'T') + 'Z';
  const data = new Date(normalizado.endsWith('Z') || normalizado.includes('+') ? normalizado : normalizado + 'Z');
  return isNaN(data.getTime()) ? null : data;
}

/** Formata como "17/08/2026 - 15:35" no fuso de Brasília. */
export function formatarDataHoraBR(valor: string | null): string {
  const data = paraDate(valor);
  if (!data) return '—';
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(data);

  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} - ${get('hour')}:${get('minute')}`;
}

/** Formata só a hora, "15:35", no fuso de Brasília. */
export function formatarHoraBR(valor: string | null): string {
  const data = paraDate(valor);
  if (!data) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(data);
}

/** Formata só a data, "17/08/2026", no fuso de Brasília. */
export function formatarDataBR(valor: string | null): string {
  const data = paraDate(valor);
  if (!data) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASIL,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data);
}

/**
 * Data de "hoje" no formato YYYY-MM-DD, usando o relógio local do navegador
 * (não UTC). Como o computador da farmácia fica fisicamente no Brasil, isso
 * reflete corretamente a data de Brasília — diferente de `new
 * Date().toISOString()`, que sempre converte para UTC e pode "adiantar" o dia
 * à noite (ex: 22h em Brasília já é 01h UTC do dia seguinte).
 */
export function hojeLocalISO(): string {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
