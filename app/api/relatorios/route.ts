import { NextRequest, NextResponse } from 'next/server';
import { query, isUsingPostgres } from '@/lib/db-adapter';

// GET /api/relatorios?tipo=anestesista&dataInicio=...&dataFim=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo') || 'anestesista';
  const dataInicio = searchParams.get('dataInicio');
  const dataFim = searchParams.get('dataFim');
  const codigo = searchParams.get('codigo');

  const dateCol = isUsingPostgres() ? 'horario_entrega::date' : 'date(horario_entrega)';
  const groupConcat = isUsingPostgres()
    ? 'STRING_AGG(DISTINCT codigo_anestesista, \',\')'
    : 'GROUP_CONCAT(DISTINCT codigo_anestesista)';

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (dataInicio) {
    whereClause += ` AND ${dateCol} >= ?`;
    params.push(dataInicio);
  }
  if (dataFim) {
    whereClause += ` AND ${dateCol} <= ?`;
    params.push(dataFim);
  }

  if (tipo === 'anestesista') {
    if (codigo) {
      whereClause += ' AND codigo_anestesista = ?';
      params.push(codigo);
    }
    const rows = await query(
      `SELECT
        codigo_anestesista,
        nome_anestesista,
        COUNT(*) as total_caixas,
        SUM(CASE WHEN status = 'em_posse' THEN 1 ELSE 0 END) as caixas_em_posse,
        SUM(CASE WHEN status = 'devolvida' THEN 1 ELSE 0 END) as caixas_devolvidas
      FROM dispensacoes
      ${whereClause}
      GROUP BY codigo_anestesista, nome_anestesista
      ORDER BY total_caixas DESC`,
      params
    );
    return NextResponse.json(rows);
  }

  if (tipo === 'paciente') {
    if (codigo) {
      whereClause += ' AND codigo_atendimento_paciente = ?';
      params.push(codigo);
    }
    const rows = await query(
      `SELECT
        codigo_atendimento_paciente,
        COUNT(*) as total_caixas,
        ${groupConcat} as anestesistas_envolvidos
      FROM dispensacoes
      ${whereClause}
      GROUP BY codigo_atendimento_paciente
      ORDER BY total_caixas DESC`,
      params
    );
    return NextResponse.json(rows);
  }

  if (tipo === 'caixa') {
    if (codigo) {
      whereClause += ' AND codigo_caixa = ?';
      params.push(codigo);
    }
    const rows = await query(
      `SELECT
        codigo_caixa,
        COUNT(*) as total_movimentacoes,
        MAX(horario_entrega) as ultima_movimentacao
      FROM dispensacoes
      ${whereClause}
      GROUP BY codigo_caixa
      ORDER BY total_movimentacoes DESC`,
      params
    );
    return NextResponse.json(rows);
  }

  if (tipo === 'pendentes') {
    const rows = await query(
      `SELECT * FROM dispensacoes WHERE status = 'em_posse' ORDER BY horario_entrega ASC`
    );
    return NextResponse.json(rows);
  }

  return NextResponse.json({ error: 'Tipo de relatório inválido.' }, { status: 400 });
}
