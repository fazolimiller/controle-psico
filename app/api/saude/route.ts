import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db-adapter';

// GET /api/saude — verificação de disponibilidade para monitoramento da TI.
// Público e sem dados: responde só se a aplicação e o banco estão respondendo.
export async function GET() {
  try {
    await queryOne('SELECT COUNT(*) AS total FROM setores');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[saude] banco indisponível', e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
