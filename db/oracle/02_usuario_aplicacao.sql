-- =============================================================================
-- Usuário de conexão da aplicação (privilégio mínimo) — executar como DBA.
-- =============================================================================
-- A aplicação conecta com PSICO_APP, que NÃO pode criar/alterar tabelas e NÃO
-- tem permissão de DELETE em nenhuma tabela. Isso garante, no próprio banco,
-- que registros de dispensação, histórico e auditoria não possam ser apagados
-- pela aplicação (as exclusões são lógicas). Na tabela de auditoria, a
-- aplicação só pode inserir e consultar.
--
-- Ajuste os nomes PSICO_OWNER / PSICO_APP e a senha conforme o padrão da TI.
-- No .env da aplicação: ORACLE_USER=PSICO_APP e ORACLE_SCHEMA=PSICO_OWNER
-- =============================================================================

CREATE USER psico_app IDENTIFIED BY "TROQUE_POR_SENHA_FORTE";
GRANT CREATE SESSION TO psico_app;

GRANT SELECT, INSERT, UPDATE ON psico_owner.usuarios          TO psico_app;
GRANT SELECT, INSERT, UPDATE ON psico_owner.setores           TO psico_app;
GRANT SELECT, INSERT, UPDATE ON psico_owner.anestesistas      TO psico_app;
GRANT SELECT, INSERT, UPDATE ON psico_owner.dispensacoes      TO psico_app;
GRANT SELECT, INSERT         ON psico_owner.historico_edicoes TO psico_app;
GRANT SELECT, INSERT         ON psico_owner.auditoria         TO psico_app;
