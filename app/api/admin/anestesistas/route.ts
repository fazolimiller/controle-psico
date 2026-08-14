import { NextRequest, NextResponse } from 'next/server';
import { query, run, isUsingPostgres } from '@/lib/db-adapter';

// GET /api/admin/anestesistas — lista para a tela de gerenciamento
export async function GET() {
  const rows = await query('SELECT * FROM anestesistas ORDER BY nome ASC');
  return NextResponse.json(rows);
}

// POST /api/admin/anestesistas — cadastrar novo vínculo crachá → nome (só admin)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { codigo_cracha, nome, crm } = body;

  if (!codigo_cracha || !nome) {
    return NextResponse.json({ error: 'Código do crachá e nome são obrigatórios.' }, { status: 400 });
  }

  const upsert = isUsingPostgres()
    ? `INSERT INTO anestesistas (codigo_cracha, nome, crm) VALUES (?, ?, ?)
       ON CONFLICT (codigo_cracha) DO UPDATE SET nome = EXCLUDED.nome, crm = EXCLUDED.crm`
    : `INSERT INTO anestesistas (codigo_cracha, nome, crm) VALUES (?, ?, ?)
       ON CONFLICT(codigo_cracha) DO UPDATE SET nome = excluded.nome, crm = excluded.crm`;

  await run(upsert, [codigo_cracha, nome, crm || null]);

  const linha = await query('SELECT * FROM anestesistas WHERE codigo_cracha = ?', [codigo_cracha]);
  return NextResponse.json(linha[0], { status: 201 });
}
