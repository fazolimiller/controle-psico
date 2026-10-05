import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, padraoLike, type Parametro } from '@/lib/db-adapter';
import { exigirSessao, rota } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { agoraUTC, dataValida, intervaloDiaBrasil } from '@/lib/tempo';
import { codigo, ErroValidacao, idValido, lerCorpo, textoOpcional } from '@/lib/validacao';

// GET /api/dispensacoes?data=2026-08-14&dataInicio=&dataFim=&status=&setorId=&anestesista=&paciente=&caixa=&incluirExcluidas=1
export const GET = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;

  const sp = new URL(req.url).searchParams;
  const condicoes: string[] = [];
  const params: Parametro[] = [];

  // Registros excluídos (exclusão lógica) só aparecem para administradores, e só quando pedidos.
  const incluirExcluidas = sp.get('incluirExcluidas') === '1' && sessao.papel === 'admin';
  if (!incluirExcluidas) condicoes.push('excluido_em IS NULL');

  const data = sp.get('data');
  const dataInicio = sp.get('dataInicio');
  const dataFim = sp.get('dataFim');
  for (const [nome, valor] of [['data', data], ['dataInicio', dataInicio], ['dataFim', dataFim]] as const) {
    if (valor && !dataValida(valor)) throw new ErroValidacao(`Data inválida em "${nome}".`);
  }
  // Datas são dias civis de Brasília, convertidos para intervalos em UTC.
  if (data) {
    const { inicio, fim } = intervaloDiaBrasil(data);
    condicoes.push('horario_entrega >= ?', 'horario_entrega < ?');
    params.push(inicio, fim);
  }
  if (dataInicio) {
    condicoes.push('horario_entrega >= ?');
    params.push(intervaloDiaBrasil(dataInicio).inicio);
  }
  if (dataFim) {
    condicoes.push('horario_entrega < ?');
    params.push(intervaloDiaBrasil(dataFim).fim);
  }

  const status = sp.get('status');
  if (status) {
    if (status !== 'em_posse' && status !== 'devolvida') throw new ErroValidacao('Status inválido.');
    condicoes.push('status = ?');
    params.push(status);
  }

  const setorId = sp.get('setorId');
  if (setorId) {
    const id = idValido(setorId);
    if (!id) throw new ErroValidacao('Setor inválido.');
    condicoes.push('setor_id = ?');
    params.push(id);
  }

  const anestesista = textoOpcional(sp.get('anestesista'), 'anestesista', 100);
  if (anestesista) {
    condicoes.push("(codigo_anestesista LIKE ? ESCAPE '\\' OR nome_anestesista LIKE ? ESCAPE '\\')");
    params.push(padraoLike(anestesista), padraoLike(anestesista));
  }
  const paciente = textoOpcional(sp.get('paciente'), 'paciente', 100);
  if (paciente) {
    condicoes.push("codigo_atendimento_paciente LIKE ? ESCAPE '\\'");
    params.push(padraoLike(paciente));
  }
  const caixa = textoOpcional(sp.get('caixa'), 'caixa', 100);
  if (caixa) {
    condicoes.push("codigo_caixa LIKE ? ESCAPE '\\'");
    params.push(padraoLike(caixa));
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const linhas = await query(`SELECT * FROM dispensacoes ${where} ORDER BY horario_entrega DESC`, params);
  return NextResponse.json(linhas);
});

// POST /api/dispensacoes — registrar nova entrega (funcionário da farmácia ou admin)
export const POST = rota(async (req: NextRequest) => {
  const auth = await exigirSessao(req, ['admin', 'funcionario']);
  if (!auth.ok) return auth.resposta;
  const { sessao } = auth;

  const corpo = await lerCorpo(req);
  const codigoAnestesista = codigo(corpo.codigo_anestesista, 'crachá do anestesista');
  const codigoCaixa = codigo(corpo.codigo_caixa, 'código da caixa');
  const codigoAtendimento = codigo(corpo.codigo_atendimento_paciente, 'atendimento');
  const setorId = idValido(corpo.setor_id);
  if (!setorId) throw new ErroValidacao('Selecione o setor antes de registrar a entrega.');
  const kitVenoso = corpo.kit_venoso === true ? 1 : 0;
  const observacoes = textoOpcional(corpo.observacoes, 'observações', 1000);
  // O horário de entrega é sempre o do servidor: não aceitamos horário enviado pelo navegador.
  const horario = agoraUTC();

  const anestesista = await queryOne<{ nome: string }>(
    'SELECT nome FROM anestesistas WHERE codigo_cracha = ? AND ativo = 1 AND excluido_em IS NULL',
    [codigoAnestesista]
  );
  if (!anestesista) {
    return NextResponse.json(
      {
        error:
          'Anestesista não cadastrado. Peça a um administrador para vincular este crachá em Administração → Anestesistas antes de dispensar a caixa.',
      },
      { status: 422 }
    );
  }

  const setor = await queryOne<{ nome: string }>('SELECT nome FROM setores WHERE id = ? AND ativo = 1 AND excluido_em IS NULL', [
    setorId,
  ]);
  if (!setor) {
    return NextResponse.json({ error: 'Setor inválido ou removido. Atualize a página e tente novamente.' }, { status: 422 });
  }

  const r = await run(
    `INSERT INTO dispensacoes
      (codigo_anestesista, nome_anestesista, codigo_caixa, codigo_atendimento_paciente, setor_id, setor_nome,
       kit_venoso, horario_entrega, observacoes, status, registrado_por_id, registrado_por_nome, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'em_posse', ?, ?, ?, ?)`,
    [
      codigoAnestesista,
      anestesista.nome,
      codigoCaixa,
      codigoAtendimento,
      setorId,
      setor.nome,
      kitVenoso,
      horario,
      observacoes,
      sessao.userId,
      sessao.nome,
      horario,
      horario,
    ],
    { returningId: true }
  );

  await registrarAuditoria({
    acao: 'dispensacao_criada',
    usuarioId: sessao.userId,
    usuarioLogin: sessao.login,
    entidade: 'dispensacao',
    entidadeId: r.lastInsertRowid,
    detalhes: { caixa: codigoCaixa, anestesista: codigoAnestesista, atendimento: codigoAtendimento, setor: setor.nome },
    req,
  });

  const nova = await queryOne('SELECT * FROM dispensacoes WHERE id = ?', [r.lastInsertRowid]);
  return NextResponse.json(nova, { status: 201 });
});
