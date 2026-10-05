// Testes unitários das peças de segurança que não dependem de banco.
// Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assinarToken, verificarToken, type DadosSessao } from '../lib/sessao-token';
import { converterPlaceholders, padraoLike } from '../lib/db-adapter';
import { intervaloDiaBrasil, normalizarHorario, dataValida } from '../lib/tempo';
import { codigo, validarSenha, idValido, ErroValidacao } from '../lib/validacao';

const SEGREDO = 'x'.repeat(40);
const LIMITES = { inatividadeMinutos: 30, duracaoMaximaHoras: 12 };
const agora = Date.UTC(2026, 9, 5, 12, 0, 0);
const base: DadosSessao = { userId: 1, login: 'a', nome: 'A', papel: 'funcionario', sv: 1, iat: agora, atv: agora };

test('token válido é aceito', async () => {
  const t = await assinarToken(base, SEGREDO);
  const r = await verificarToken(t, SEGREDO, LIMITES, agora + 60_000);
  assert.equal(r.ok, true);
});

test('token adulterado (papel trocado para admin) é rejeitado', async () => {
  const t = await assinarToken(base, SEGREDO);
  const [, assinatura] = t.split('.');
  const falso = Buffer.from(JSON.stringify({ ...base, papel: 'admin' })).toString('base64url');
  const r = await verificarToken(`${falso}.${assinatura}`, SEGREDO, LIMITES, agora);
  assert.deepEqual(r, { ok: false, motivo: 'invalido' });
});

test('token assinado com outro segredo é rejeitado', async () => {
  const t = await assinarToken(base, 'y'.repeat(40));
  assert.equal((await verificarToken(t, SEGREDO, LIMITES, agora)).ok, false);
});

test('sessão expira por inatividade', async () => {
  const t = await assinarToken(base, SEGREDO);
  const r = await verificarToken(t, SEGREDO, LIMITES, agora + 31 * 60_000);
  assert.deepEqual(r, { ok: false, motivo: 'inatividade' });
});

test('sessão expira pela duração máxima mesmo com atividade', async () => {
  const t = await assinarToken({ ...base, atv: agora + 12 * 3600_000 }, SEGREDO);
  const r = await verificarToken(t, SEGREDO, LIMITES, agora + 12 * 3600_000 + 1000);
  assert.deepEqual(r, { ok: false, motivo: 'expirado' });
});

test('placeholders convertidos para Oracle e PostgreSQL, preservando literais', () => {
  const sql = "SELECT * FROM t WHERE a = ? AND b LIKE ? ESCAPE '\\' AND c = 'texto?' AND d = ?";
  assert.equal(
    converterPlaceholders(sql, (n) => `:${n}`).sql,
    "SELECT * FROM t WHERE a = :1 AND b LIKE :2 ESCAPE '\\' AND c = 'texto?' AND d = :3"
  );
  assert.equal(converterPlaceholders(sql, (n) => `$${n}`).total, 3);
});

test('curingas de LIKE vindos do usuário são escapados', () => {
  assert.equal(padraoLike('50%_a\\b'), '%50\\%\\_a\\\\b%');
});

test('dia de Brasília vira intervalo UTC correto (UTC-3)', () => {
  assert.deepEqual(intervaloDiaBrasil('2026-10-05'), { inicio: '2026-10-05 03:00:00', fim: '2026-10-06 03:00:00' });
});

test('normalização de horário e validação de datas', () => {
  assert.equal(normalizarHorario('2026-10-05T15:30:00-03:00'), '2026-10-05 18:30:00');
  assert.equal(normalizarHorario("2026-10-05'; DROP TABLE x;--"), null);
  assert.equal(dataValida('2026-02-30'), false);
  assert.equal(dataValida('2026-02-28'), true);
});

test('validação de entrada rejeita injeção e senhas fracas', () => {
  assert.throws(() => codigo("1' OR '1'='1", 'crachá'), ErroValidacao);
  assert.equal(codigo('CX-014', 'caixa'), 'CX-014');
  assert.throws(() => validarSenha('1234567'), ErroValidacao);
  assert.throws(() => validarSenha('somenteletras'), ErroValidacao);
  assert.equal(validarSenha('Farmacia2026'), 'Farmacia2026');
  assert.equal(idValido('12'), 12);
  assert.equal(idValido('1 OR 1=1'), null);
  assert.equal(idValido('-3'), null);
});
