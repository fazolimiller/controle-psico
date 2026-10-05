// Validação de entrada. Todo dado vindo do navegador é tratado como não
// confiável: tipo, tamanho e formato são conferidos no servidor antes de
// chegar ao banco, mesmo que a tela já faça a mesma checagem.

export class ErroValidacao extends Error {}

/** Lê o corpo JSON da requisição como objeto; rejeita qualquer outra coisa. */
export async function lerCorpo(req: Request): Promise<Record<string, unknown>> {
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    throw new ErroValidacao('Corpo da requisição inválido.');
  }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroValidacao('Corpo da requisição inválido.');
  }
  return corpo as Record<string, unknown>;
}

/** Identificador numérico positivo (ids de rota, setor_id...). */
export function idValido(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && /^\d{1,12}$/.test(valor) ? Number(valor) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Texto opcional: devolve string aparada, null se vazio/ausente.
 * Lança ErroValidacao se não for texto ou exceder o tamanho.
 */
export function textoOpcional(valor: unknown, campo: string, max: number): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw new ErroValidacao(`O campo "${campo}" deve ser texto.`);
  const s = valor.trim();
  if (!s) return null;
  if (s.length > max) throw new ErroValidacao(`O campo "${campo}" aceita no máximo ${max} caracteres.`);
  // Caracteres de controle não têm uso legítimo nestes campos.
  if (/[\u0000-\u001F\u007F]/.test(s)) throw new ErroValidacao(`O campo "${campo}" contém caracteres inválidos.`);
  return s;
}

export function textoObrigatorio(valor: unknown, campo: string, max: number): string {
  const s = textoOpcional(valor, campo, max);
  if (!s) throw new ErroValidacao(`O campo "${campo}" é obrigatório.`);
  return s;
}

/** Códigos lidos por leitor (crachá, caixa, atendimento): sem espaços internos estranhos. */
export function codigo(valor: unknown, campo: string): string {
  const s = textoObrigatorio(valor, campo, 100);
  if (!/^[\p{L}\p{N}._\-/:# ]+$/u.test(s)) throw new ErroValidacao(`O campo "${campo}" contém caracteres não permitidos.`);
  return s;
}

export const TAMANHO_MINIMO_SENHA = 8;

/** Política de senha: mínimo de 8 caracteres, com letras e números. */
export function validarSenha(senha: unknown): string {
  if (typeof senha !== 'string') throw new ErroValidacao('Senha inválida.');
  if (senha.length < TAMANHO_MINIMO_SENHA) {
    throw new ErroValidacao(`A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
  }
  if (senha.length > 72) throw new ErroValidacao('A senha deve ter no máximo 72 caracteres.');
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) {
    throw new ErroValidacao('A senha deve conter letras e números.');
  }
  return senha;
}

export function papelValido(valor: unknown): 'admin' | 'funcionario' {
  if (valor === 'admin' || valor === 'funcionario') return valor;
  throw new ErroValidacao('Papel inválido.');
}

export function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor === 'boolean') return valor;
  throw new ErroValidacao(`O campo "${campo}" deve ser verdadeiro ou falso.`);
}
