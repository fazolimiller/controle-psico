import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, type Parametro } from '@/lib/db-adapter';
import { exigirSessao, rota } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { agoraUTC, normalizarHorario } from '@/lib/tempo';
import { codigo, ErroValidacao, idValido, lerCorpo, textoObrigatorio, textoOpcional } from '@/lib/validacao';

type Contexto = { params: Promise<{ id: string }> };

// Campos que um administrador pode corrigir. Esta lista fixa é a única fonte
// de nomes de coluna usados no UPDATE dinâmico abaixo.
const CAMPOS_EDITAVEIS = [
  'codigo_anestesista',
  'codigo_caixa',
  'codigo_atendimento_paciente',
  'horario_entrega',
  'horario_devolucao',
  'observacoes',
] as const;
type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number];

function validarCampo(campo: CampoEditavel, valor: unknown): string | null {
  switch (campo) {
    case 'codigo_anestesista':
      return codigo(valor, 'crachá do anestesista');
    case 'codigo_caixa':
      return codigo(valor, 'código da caixa');
    case 'codigo_atendimento_paciente':
      return codigo(valor, 'atendimento');
    case 'horario_entrega': {
      const h = normalizarHorario(valor);
      if (!h) throw new ErroValidacao('Horário de entrega inválido.');
      return h;
    }
    case 'horario_devolucao': {
      if (valor === null || valor === '') return null;
      const h = normalizarHorario(valor);
      if (!h) throw new ErroValidacao('Horário de devolução inválido.');
      return h;
    }
    case 'observacoes':
      return textoOpcional(valor, 'observações', 1000);
  }
}

async function carregar(id: number) {
  return queryOne<Record<string, unknown>>('SELECT * FROM dispensacoes WHERE id = ?', [id]);
}

// GET /api/dispensacoes/:id — detalhe + histórico de correções
export const GET = rota(async (req: NextRequest, { params }: Contexto) => {
  const auth = await exigirSessao(req);
  if (!auth.ok) return auth.resposta;
  const id = idValido((await params).id);
  if (!id) throw new ErroValidacao('Identificador inválido.');

  const linha = await carregar(id);
  if (!linha || (linha.excluido_em && auth.sessao.papel !== 'admin')) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  }
  const historico = await query('SELECT * FROM historico_edicoes WHERE dispensacao_id = ? ORDER BY alterado_em DESC', [id]);
  return NextResponse.json({ ...linha, historico });
});

// PATCH /api/dispensacoes/:id — corrigir registro (SOMENTE ADMIN), com histórico campo a campo
export const PATCH = rota(async (req: NextRequest, { params }: Contexto) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;
  const id = idValido((await params).id);
  if (!id) throw new ErroValidacao('Identificador inválido.');

  const atual = await carregar(id);
  if (!atual || atual.excluido_em) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  }

  const corpo = await lerCorpo(req);
  const alteracoes: { campo: string; antes: unknown; depois: Parametro }[] = [];

  for (const campo of CAMPOS_EDITAVEIS) {
    if (!(campo in corpo)) continue;
    const novo = validarCampo(campo, corpo[campo]);
    const antes = atual[campo] ?? null;
    if (String(novo ?? '') !== String(antes ?? '')) alteracoes.push({ campo, antes, depois: novo });
  }

  // Trocar o crachá também atualiza o nome gravado, a partir do cadastro.
  const trocaCracha = alteracoes.find((a) => a.campo === 'codigo_anestesista');
  if (trocaCracha) {
    const anest = await queryOne<{ nome: string }>(
      'SELECT nome FROM anestesistas WHERE codigo_cracha = ? AND ativo = 1 AND excluido_em IS NULL',
      [trocaCracha.depois]
    );
    if (!anest) {
      return NextResponse.json({ error: 'O crachá informado não pertence a um anestesista cadastrado e ativo.' }, { status: 422 });
    }
    alteracoes.push({ campo: 'nome_anestesista', antes: atual.nome_anestesista, depois: anest.nome });
  }

  const novaDevolucao = alteracoes.find((a) => a.campo === 'horario_devolucao');
  if (novaDevolucao) {
    alteracoes.push({
      campo: 'status',
      antes: atual.status,
      depois: novaDevolucao.depois ? 'devolvida' : 'em_posse',
    });
  }

  if (alteracoes.length === 0) return NextResponse.json(atual);

  const motivo = textoObrigatorio(corpo.motivo ?? 'Correção administrativa', 'motivo', 500);
  const agora = agoraUTC();
  for (const a of alteracoes) {
    await run(
      `INSERT INTO historico_edicoes (dispensacao_id, campo_alterado, valor_anterior, valor_novo, editado_por_id, editado_por_nome, alterado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, a.campo, a.antes === null ? null : String(a.antes), a.depois === null ? null : String(a.depois), sessao.userId, sessao.nome, agora]
    );
  }

  // Nomes de coluna vêm exclusivamente da whitelist acima (mais nome_anestesista/status, fixos no código).
  const sets = alteracoes.map((a) => `${a.campo} = ?`);
  const valores = alteracoes.map((a) => a.depois);
  await run(`UPDATE dispensacoes SET ${sets.join(', ')}, atualizado_em = ? WHERE id = ?`, [...valores, agora, id]);

  await registrarAuditoria({
    acao: 'dispensacao_corrigida',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'dispensacao',
    entidadeId: id,
    detalhes: { motivo, campos: alteracoes.map((a) => ({ campo: a.campo, antes: a.antes, depois: a.depois })) },
    req,
  });

  return NextResponse.json(await carregar(id));
});

// DELETE /api/dispensacoes/:id — EXCLUSÃO LÓGICA (SOMENTE ADMIN).
// O registro deixa de aparecer nas telas, mas permanece no banco com quem
// excluiu, quando e por quê. O histórico de correções é preservado.
export const DELETE = rota(async (req: NextRequest, { params }: Contexto) => {
  const auth = await exigirSessao(req, ['admin']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;
  const id = idValido((await params).id);
  if (!id) throw new ErroValidacao('Identificador inválido.');

  const corpo = await lerCorpo(req).catch(() => ({}) as Record<string, unknown>);
  const motivo = textoOpcional(corpo.motivo, 'motivo', 500);
  if (!motivo || motivo.length < 5) {
    throw new ErroValidacao('Informe o motivo da exclusão (mínimo de 5 caracteres).');
  }

  const linha = await carregar(id);
  if (!linha || linha.excluido_em) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  }

  const agora = agoraUTC();
  await run(
    `UPDATE dispensacoes SET excluido_em = ?, excluido_por_id = ?, excluido_por_nome = ?, motivo_exclusao = ?, atualizado_em = ?
     WHERE id = ? AND excluido_em IS NULL`,
    [agora, sessao.userId, sessao.nome, motivo, agora, id]
  );

  await registrarAuditoria({
    acao: 'dispensacao_excluida',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'dispensacao',
    entidadeId: id,
    detalhes: { motivo, caixa: linha.codigo_caixa, anestesista: linha.codigo_anestesista, atendimento: linha.codigo_atendimento_paciente },
    req,
  });

  return NextResponse.json({ ok: true });
});
