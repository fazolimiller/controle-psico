import { query, run } from './db-adapter';

const SETORES_PADRAO = ['Centro Cirúrgico 1', 'Centro Cirúrgico 2', 'Hemodinâmica', 'Endoscopias'];

let setoresEnsured = false;

// Garante que existam os setores padrão na primeira vez que o sistema roda —
// mesma lógica usada para o admin inicial. Se um admin já tiver removido
// todos os setores de propósito, não recriamos (só semeia quando a tabela
// está vazia pela primeira vez).
export async function ensureSetoresIniciais(): Promise<void> {
  if (setoresEnsured) return;

  const existentes = await query<{ total: number }>('SELECT COUNT(*) as total FROM setores');
  const total = Number(existentes[0]?.total ?? 0);

  if (total === 0) {
    for (const nome of SETORES_PADRAO) {
      await run('INSERT INTO setores (nome, ativo) VALUES (?, 1)', [nome]);
    }
  }

  setoresEnsured = true;
}
