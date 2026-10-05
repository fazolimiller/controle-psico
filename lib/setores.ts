import { queryOne, run } from './db-adapter';
import { agoraUTC } from './tempo';

const SETORES_PADRAO = ['Centro Cirúrgico 1', 'Centro Cirúrgico 2', 'Hemodinâmica', 'Endoscopias'];

let setoresVerificados = false;

// Semeia os setores padrão somente na primeira execução (tabela vazia).
// Setores removidos depois (exclusão lógica) continuam na tabela e não são recriados.
export async function ensureSetoresIniciais(): Promise<void> {
  if (setoresVerificados) return;
  const linha = await queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM setores');
  if (Number(linha?.total ?? 0) === 0) {
    for (const nome of SETORES_PADRAO) {
      await run('INSERT INTO setores (nome, ativo, criado_em) VALUES (?, 1, ?)', [nome, agoraUTC()]);
    }
  }
  setoresVerificados = true;
}
