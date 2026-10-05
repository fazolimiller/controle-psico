# Adequações ao Relatório Técnico da TI (reunião de 20/08/2026)

Este documento relaciona cada ponto levantado pela equipe de TI (Marcos Dias e Gustavo Godoy) ao que foi alterado no código, e onde conferir.

## Pontos do relato do analista

### 1. Secrets e variáveis de ambiente
- Removidos do código todos os valores padrão sensíveis. O antigo segredo de sessão `dev-secret-troque-em-producao` não existe mais.
- Toda a configuração é lida de variáveis de ambiente em um único módulo (`lib/config.ts`). Se faltar uma variável obrigatória, a aplicação falha com mensagem clara em vez de usar um padrão inseguro.
- `SESSION_SECRET` exige no mínimo 32 caracteres.
- `.env.example` documenta todas as variáveis. O `.env` fica fora do repositório e fora da pasta da aplicação no servidor, com permissão 600.
- Removida do repositório uma cópia compactada antiga do código-fonte (`farmacia-psicotropicos-main_3.zip`).

### 2. Exclusão de registros → soft delete
- Dispensações, anestesistas e setores deixaram de ser apagados. A exclusão marca `excluido_em`, `excluido_por` e, nas dispensações, o **motivo obrigatório**.
- O histórico de correções (`historico_edicoes`) nunca é apagado (antes era apagado junto com a dispensação).
- Registros excluídos somem das telas, mas o administrador pode exibi-los e exportá-los em Relatórios ("Incluir registros excluídos").
- No Oracle, o usuário da aplicação **não tem privilégio de DELETE** em nenhuma tabela (`db/oracle/02_usuario_aplicacao.sql`): a regra é garantida pelo próprio banco.

### 3. Segurança das queries SQL / SQL Injection
- Todas as consultas passam por uma camada única (`lib/db-adapter.ts`), sempre com **parâmetros vinculados** (bind variables). Nenhum valor do usuário é concatenado ao SQL.
- Os nomes de coluna em UPDATEs dinâmicos vêm apenas de listas fixas no código (whitelist).
- Os curingas de `LIKE` (`%`, `_`) digitados pelo usuário são escapados.
- Validação de entrada no servidor (`lib/validacao.ts`) em todas as rotas: tipo, tamanho, formato de códigos, datas e identificadores numéricos.
- Removido um endpoint de relatórios (`/api/relatorios`) que não era usado pela interface.
- Testes automatizados cobrem tentativas de injeção (`npm test` e testes de API).

### 4. Credenciais administrativas fixas no código
- Removido o fallback `admin` / `admin123`.
- O primeiro administrador só é criado a partir do `.env` (`ADMIN_LOGIN` / `ADMIN_SENHA`), apenas se não existir nenhum usuário, e **com troca de senha obrigatória no primeiro acesso**. Depois disso, `ADMIN_SENHA` deve ser removida do `.env`.
- Senhas com bcrypt (custo 12). Nenhuma senha em texto no banco ou no código.

### 5. Migração PostgreSQL → Oracle
- Novo módulo `lib/db-oracle.ts` com o driver oficial `node-oracledb` em modo thin (sem Oracle Instant Client).
- Scripts DDL em `db/oracle/` (Oracle 12.1+), com constraints de domínio e índices.
- O SQL da aplicação foi reescrito em forma portátil: sem funções de data específicas de banco, sem `LIMIT`/`ON CONFLICT`, com horários em UTC gerados pela aplicação. O mesmo código roda em Oracle, PostgreSQL e SQLite (desenvolvimento).
- Corrigido um defeito latente: em servidor configurado com o fuso de Brasília, os horários seriam deslocados em 3 horas.
- **Pendência:** o adaptador Oracle foi verificado estaticamente, mas precisa ser validado pela TI em uma instância Oracle de homologação. Os demais bancos foram testados de ponta a ponta.

### 6. Autenticação e autorização
- **Autorização no servidor em toda rota da API** (`lib/auth.ts`). O usuário e o papel são relidos do banco a cada requisição, sem depender só do cookie ou da tela.
- Usuário desativado, rebaixado de papel ou com senha trocada **perde o acesso imediatamente** (versão de sessão).
- Expiração por **inatividade** (30 min, configurável) e duração máxima de sessão (12 h).
- **Bloqueio temporário** após 5 senhas erradas (15 min, configurável), com desbloqueio pelo administrador.
- Política de senha: mínimo de 8 caracteres, letras e números. Troca obrigatória no primeiro acesso.
- Resposta de login com tempo constante, para não revelar quais logins existem.
- Cookie de sessão `httpOnly`, `SameSite=Strict`, `Secure` em produção, assinado com HMAC-SHA256 e verificado em tempo constante.
- Proteção contra **CSRF**: requisições de escrita vindas de outra origem são recusadas.
- Cabeçalhos de segurança: **Content Security Policy com nonce**, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS em HTTPS.
- Não é possível remover o último administrador ativo, nem um administrador se desativar ou rebaixar.
- O horário de entrega e de devolução é sempre o do servidor (o navegador não pode informar outro).
- Proteção contra fórmulas maliciosas ("CSV injection") nos arquivos CSV e Excel exportados.

### 7. Migração da infraestrutura (Vercel → datacenter)
- Build `standalone`: pacote autossuficiente executado com `node server.js`.
- `DEPLOY.md` com o passo a passo, além de modelos de serviço systemd (com endurecimento) e de nginx com HTTPS em `deploy/`.
- Fontes servidas pela própria aplicação: o sistema não depende de internet nem de serviços externos.
- Endpoint de monitoramento `GET /api/saude`.

### 8. Manutenção tecnológica (stack diferente do padrão PHP)
- Código comentado em português, explicando as regras de segurança nos pontos críticos.
- Documentação: `README.md`, `DEPLOY.md` e este documento.
- Testes automatizados (`npm test`) para as peças de segurança.
- O desenvolvedor se compromete a acompanhar a equipe de TI na implantação e na homologação.

## Melhorias sugeridas pela supervisão que não dependem do MV

- **Logs detalhados e trilha de auditoria:** nova tabela `auditoria` e tela Administração → Auditoria, com filtros e exportação CSV. São registrados login, falha de login, bloqueio, logout, troca de senha, entrega, devolução, correção (valor anterior e novo), exclusão (com motivo), cadastros e tentativas de acesso negado, sempre com usuário, data/hora e IP.
- **Interface responsiva:** em tablets e celulares, a lista de caixas vira cartões com botões maiores. Os formulários se reorganizam em uma ou duas colunas, e as tabelas administrativas rolam horizontalmente.

## Fora do escopo

Integrações com o MV Soul (autenticação, atendimento, cadastro de profissionais, estoque e relatórios), conforme a justificativa registrada no formulário FOR TCI.

## Como verificar

```bash
npm ci
npm test        # 10 testes unitários (token, injeção, validação, datas, placeholders Oracle/PostgreSQL)
npm run build
```

Os testes de ponta a ponta foram executados contra PostgreSQL 16 e SQLite: 43 cenários de API, como controle de papéis, CSRF, injeção, bloqueio de login, revogação de sessão, soft delete e auditoria, além de navegação no browser em desktop, tablet e celular, sem erros de console com a CSP ativa.
