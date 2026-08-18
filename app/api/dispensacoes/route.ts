import { NextRequest, NextResponse } from 'next/server';
import { query, run, isUsingPostgres } from '@/lib/db-adapter';
import { getSession } from '@/lib/auth';

// GET /api/dispensacoes?data=2026-08-14&anestesista=...&paciente=...&caixa=...&status=...&setorId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const data = searchParams.get('data');
  const anestesista = searchParams.get('anestesista');
  const paciente = searchParams.get('paciente');
  const caixa = searchParams.get('caixa');
  const status = searchParams.get('status');
  const dataInicio = searchParams.get('dataInicio');
  const dataFim = searchParams.get('dataFim');
  const setorId = searchParams.get('setorId');

  let sql = 'SELECT * FROM dispensacoes WHERE 1=1';
  const params: (string | number)[] = [];
  // Os horários são gravados em UTC; o Brasil está fixo em UTC-3 (sem horário de
  // verão desde 2019), então subtraímos 3 horas antes de extrair a data civil —
  // assim uma entrega às 23h (Brasília) continua contando como "hoje", não amanhã.
  const dateCol = isUsingPostgres()
    ? "(horario_entrega - interval '3 hours')::date"
    : "date(horario_entrega, '-3 hours')";

  if (data) {
    sql += ` AND ${dateCol} = ?`;
    params.push(data);
  }
  if (dataInicio) {
    sql += ` AND ${dateCol} >= ?`;
    params.push(dataInicio);
  }
  if (dataFim) {
    sql += ` AND ${dateCol} <= ?`;
    params.push(dataFim);
  }
  if (anestesista) {
    sql += ' AND (codigo_anestesista LIKE ? OR nome_anestesista LIKE ?)';
    params.push(`%${anestesista}%`, `%${anestesista}%`);
  }
  if (paciente) {
    sql += ' AND codigo_atendimento_paciente LIKE ?';
    params.push(`%${paciente}%`);
  }
  if (caixa) {
    sql += ' AND codigo_caixa LIKE ?';
    params.push(`%${caixa}%`);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (setorId) {
    sql += ' AND setor_id = ?';
    params.push(Number(setorId));
  }

  sql += ' ORDER BY horario_entrega DESC';

  const rows = await query(sql, params);
  return NextResponse.json(rows);
}

// POST /api/dispensacoes — registrar nova entrega
export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const {
    codigo_anestesista,
    codigo_caixa,
    codigo_atendimento_paciente,
    setor_id,
    kit_venoso,
    horario_entrega,
    observacoes,
  } = body;

  if (!codigo_anestesista || !codigo_caixa || !codigo_atendimento_paciente) {
    return NextResponse.json(
      { error: 'Código do anestesista, código da caixa e código do atendimento são obrigatórios.' },
      { status: 400 }
    );
  }

  if (!setor_id) {
    return NextResponse.json({ error: 'Selecione o setor antes de registrar a entrega.' }, { status: 400 });
  }

  const anestesista = await query<{ nome: string; ativo: number }>(
    'SELECT nome, ativo FROM anestesistas WHERE codigo_cracha = ?',
    [codigo_anestesista]
  );

  if (anestesista.length === 0 || !anestesista[0].ativo) {
    return NextResponse.json(
      {
        error:
          'Anestesista não cadastrado. Peça a um administrador para vincular este crachá em Administração → Anestesistas antes de dispensar a caixa.',
      },
      { status: 422 }
    );
  }

  const setor = await query<{ nome: string; ativo: number }>('SELECT nome, ativo FROM setores WHERE id = ?', [
    Number(setor_id),
  ]);

  if (setor.length === 0 || !setor[0].ativo) {
    return NextResponse.json({ error: 'Setor inválido ou removido. Atualize a página e tente novamente.' }, { status: 422 });
  }

  const horarioFinal = horario_entrega || new Date().toISOString().slice(0, 19).replace('T', ' ');

  const result = await run(
    `INSERT INTO dispensacoes
      (codigo_anestesista, nome_anestesista, codigo_caixa, codigo_atendimento_paciente, setor_id, setor_nome, kit_venoso, horario_entrega, observacoes, status, registrado_por_id, registrado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'em_posse', ?, ?)`,
    [
      codigo_anestesista,
      anestesista[0].nome,
      codigo_caixa,
      codigo_atendimento_paciente,
      Number(setor_id),
      setor[0].nome,
      kit_venoso ? 1 : 0,
      horarioFinal,
      observacoes || null,
      session?.userId ?? null,
      session?.nome ?? null,
    ],
    { returningId: true }
  );

  const novaLinha = await query('SELECT * FROM dispensacoes WHERE id = ?', [Number(result.lastInsertRowid)]);
  return NextResponse.json(novaLinha[0], { status: 201 });
}
