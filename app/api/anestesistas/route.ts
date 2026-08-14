import { NextResponse } from 'next/server';
import { query } from '@/lib/db-adapter';

// GET /api/anestesistas — lista todos (uso: resolver nome ao ler crachá, e telas de consulta)
export async function GET() {
  const rows = await query('SELECT * FROM anestesistas ORDER BY nome ASC');
  return NextResponse.json(rows);
}
