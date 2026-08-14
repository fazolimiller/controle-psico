import { NextRequest, NextResponse } from 'next/server';
import { query, run, isUsingPostgres } from '@/lib/db-adapter';
import { getSession } from '@/lib/auth';

// GET /api/dispensacoes?data=2026-08-14&anestesista=...&paciente=...&caixa=...&status=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const data = searchParams.get('data');
  const anestesista = searchParams.get('anestesista');
  const paciente = searchParams.get('paciente');
  const caixa = searchParams.get('caixa');
  const status = searchParams.get('status');
  const dataInicio = searchParams.get('dataInicio');
  const dataFim = searchParams.get('dataFim');

  let sql = 'SELECT * FROM dispensacoes WHERE 1=1';
  const params: (string | number)[] = [];
  const dateCol = isUsingPostgres() ? "horario_entrega::date" : "date(horario_entrega)";

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

  sql += ' ORDER BY horario_entrega DESC';

  const rows = await query(sql, params);
  return NextResponse.json(rows);
}

// POST /api/dispensacoes — registrar nova entrega
export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const { codigo_anestesista, codigo_caixa, codigo_atendimento_paciente, horario_entrega, observacoes } = body;

  if (!codigo_anestesista || !codigo_caixa || !codigo_atendimento_paciente) {
    return NextResponse.json(
      { error: 'Código do anestesista, código da caixa e código de atendimento são obrigatórios.' },
      { status: 400 }
    );
  }

  const anestesista = await query<{ nome: string }>(
    'SELECT nome FROM anestesistas WHERE codigo_cracha = ?',
    [codigo_anestesista]
  );

  const horarioFinal = horario_entrega || new Date().toISOString().slice(0, 19).replace('T', ' ');

  const result = await run(
    `INSERT INTO dispensacoes
      (codigo_anestesista, nome_anestesista, codigo_caixa, codigo_atendimento_paciente, horario_entrega, observacoes, status, registrado_por_id, registrado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, 'em_posse', ?, ?)`,
    [
      codigo_anestesista,
      anestesista[0]?.nome || null,
      codigo_caixa,
      codigo_atendimento_paciente,
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
