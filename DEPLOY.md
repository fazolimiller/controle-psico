# Guia de implantação — Controle de Psicotrópicos

Guia para a equipe de TI instalar a aplicação no datacenter da Santa Casa, com banco Oracle.

## 1. Visão geral

| Item | Definição |
|---|---|
| Aplicação | Next.js 16 (React 19, TypeScript), executada como processo Node.js |
| Runtime | Node.js 22 LTS (22.12 ou superior) |
| Banco | Oracle 12.1 ou superior, driver oficial `node-oracledb` em modo thin (**não precisa de Instant Client**) |
| Porta interna | 3000, acessível só pelo proxy reverso (127.0.0.1) |
| Publicação | nginx, IIS ou outro proxy reverso com HTTPS |
| Integrações | Nenhuma (escopo definido no FOR TCI) |

A aplicação não acessa a internet em tempo de execução: fontes e bibliotecas vêm no pacote.

## 2. Banco de dados Oracle (DBA)

1. Crie o esquema dono das tabelas (ex.: `PSICO_OWNER`) e, conectado com ele, execute `db/oracle/01_schema.sql`.
2. Execute `db/oracle/02_usuario_aplicacao.sql` como DBA. Ele cria o usuário de conexão `PSICO_APP` com privilégio mínimo:
   - **sem** permissão de criar ou alterar tabelas;
   - **sem** permissão de `DELETE` em nenhuma tabela (as exclusões da aplicação são lógicas);
   - na `auditoria` e no `historico_edicoes`, apenas `SELECT` e `INSERT`.

Assim, mesmo que a aplicação fosse comprometida, os registros de dispensação, o histórico e a trilha de auditoria não poderiam ser apagados por ela.

> Oracle 11g: o modo thin não suporta 11g, e as colunas `IDENTITY` exigem 12c. Se necessário, avise o desenvolvedor para gerar a versão com sequences/triggers e modo thick.

## 3. Gerar o pacote (máquina de build)

```bash
npm ci
npm test            # testes unitários de segurança
npm run build
# monta o pacote autossuficiente:
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

O diretório `.next/standalone` é o que vai para o servidor (já contém o `node_modules` necessário, inclusive o driver Oracle).

## 4. Servidor (Linux)

```bash
# usuário de serviço sem shell
useradd --system --home /opt/controle-psico --shell /usr/sbin/nologin psico
mkdir -p /opt/controle-psico/app
cp -r .next/standalone/. /opt/controle-psico/app/
cp .env.example /opt/controle-psico/.env
chown -R psico:psico /opt/controle-psico
chmod 600 /opt/controle-psico/.env
```

Edite `/opt/controle-psico/.env` (ver seção 5) e instale o serviço:

```bash
cp deploy/controle-psico.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now controle-psico
systemctl status controle-psico
curl http://127.0.0.1:3000/api/saude     # {"ok":true}
```

Publique com HTTPS usando `deploy/nginx-controle-psico.conf` como modelo. Os cabeçalhos `X-Forwarded-Host` e `Host` precisam ser repassados: a aplicação os usa para bloquear requisições de outras origens (CSRF).

**Windows Server:** o mesmo pacote roda com `node server.js`. Para rodar como serviço, use NSSM ou o agendador de tarefas e publique pelo IIS com o módulo URL Rewrite/ARR como proxy reverso. As variáveis do `.env` podem ser definidas como variáveis de ambiente do serviço.

## 5. Variáveis de ambiente

Todas estão documentadas em `.env.example`. Nenhuma credencial ou segredo tem valor padrão no código: se faltar algo obrigatório, a aplicação responde "configuração incompleta" e registra no log qual variável está ausente.

| Variável | Obrigatória | Observação |
|---|---|---|
| `SESSION_SECRET` | Sim | Mínimo de 32 caracteres. Gere com `openssl rand -hex 32` |
| `DB_CLIENT` | Sim | `oracle` |
| `ORACLE_USER` / `ORACLE_PASSWORD` | Sim | Usuário de aplicação (`PSICO_APP`) |
| `ORACLE_CONNECT_STRING` | Sim | `host:1521/SERVICO` |
| `ORACLE_SCHEMA` | Recomendado | Dono das tabelas (`PSICO_OWNER`) |
| `ADMIN_LOGIN` / `ADMIN_SENHA` | Só na 1ª execução | Cria o primeiro administrador. **Apague `ADMIN_SENHA` após o primeiro acesso** |
| `SESSION_IDLE_MINUTES` | Não (30) | Encerramento por inatividade |
| `SESSION_MAX_HOURS` | Não (12) | Duração máxima da sessão |
| `LOGIN_MAX_TENTATIVAS` / `LOGIN_BLOQUEIO_MINUTOS` | Não (5 / 15) | Bloqueio temporário por senha errada |
| `COOKIE_SECURE` | Não | Padrão ligado em produção (exige HTTPS) |

## 6. Primeiro acesso

1. Com `ADMIN_LOGIN` e `ADMIN_SENHA` definidos, acesse o sistema e entre com essas credenciais.
2. O sistema obriga a troca da senha. Depois disso, **remova `ADMIN_SENHA` do `.env`** e reinicie o serviço.
3. Em Administração, cadastre os usuários da farmácia, os anestesistas (crachá + CRM) e confira os setores.
   Todo usuário criado pelo administrador troca a senha no primeiro acesso.

## 7. Operação

- **Monitoramento:** `GET /api/saude` responde 200 com `{"ok":true}` quando aplicação e banco estão no ar (503 caso contrário).
- **Logs:** saída padrão do serviço (`journalctl -u controle-psico`). Erros internos não são exibidos ao usuário, só registrados no log.
- **Auditoria:** consultável em Administração → Auditoria, com exportação em CSV, ou direto na tabela `AUDITORIA`.
- **Backup:** pela rotina de backup do Oracle da instituição. Não há arquivos de dados no servidor da aplicação.
- **Atualização:** gere um novo pacote (seção 3), substitua `/opt/controle-psico/app` e reinicie o serviço. O `.env` fica fora da pasta da aplicação e não é afetado.

## 8. Desenvolvimento local

```bash
npm install
cp .env.example .env.local     # preencha SESSION_SECRET e ADMIN_*; deixe DB_CLIENT=sqlite
npm run dev
```

O SQLite (`data/farmacia.db`) é apenas para desenvolvimento e é bloqueado em produção. Também é possível usar PostgreSQL (`DB_CLIENT=postgres` + `POSTGRES_URL`), que cria as tabelas automaticamente.
