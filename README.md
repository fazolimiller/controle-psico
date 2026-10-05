# Controle de Psicotrópicos — Farmácia (Santa Casa de São José dos Campos)

Sistema interno para controlar a dispensação e a devolução das caixas de psicotrópicos da anestesiologia. Cada entrega registra anestesista (leitura do crachá), setor, caixa, atendimento e funcionário responsável, com histórico permanente, auditoria e relatórios.

## Funcionalidades

- **Abas por setor** (Centro Cirúrgico 1 e 2, Hemodinâmica, Endoscopias; configuráveis).
- **Leitura do crachá** por leitor que emula teclado: o nome aparece automaticamente, e crachá não cadastrado bloqueia o registro.
- **Entrega e devolução** com horário do servidor, kit venosa e indicação de quem devolveu (destacado quando difere de quem retirou).
- **Perfis:**
  - Funcionário da farmácia: registra entregas e devoluções.
  - Administrador: também corrige registros (com histórico campo a campo e motivo), faz exclusões lógicas com motivo obrigatório e gerencia usuários, anestesistas e setores.
- **Relatórios** por período, com busca e exportação em CSV e Excel. O administrador pode incluir registros excluídos.
- **Auditoria** de todas as ações, com filtros e exportação.
- **Interface responsiva** para computador, tablet e celular.

## Segurança

Resumo das medidas, detalhadas em [ADEQUACOES-SEGURANCA.md](ADEQUACOES-SEGURANCA.md):

- Nenhum segredo ou credencial no código.
- Exclusão lógica e usuário de banco sem permissão de DELETE.
- Consultas sempre parametrizadas.
- Autorização no servidor a cada requisição.
- Bloqueio por tentativas, expiração por inatividade e troca de senha obrigatória.
- Proteção CSRF, CSP com nonce e trilha de auditoria.

## Tecnologia

Next.js 16 · React 19 · TypeScript · Node.js 22 · Oracle (produção) / PostgreSQL / SQLite (desenvolvimento).

## Documentação

- [DEPLOY.md](DEPLOY.md): implantação no datacenter (Oracle, serviço, proxy HTTPS, variáveis, operação).
- [ADEQUACOES-SEGURANCA.md](ADEQUACOES-SEGURANCA.md): resposta item a item ao Relatório Técnico da TI.
- `db/oracle/`: scripts de criação do esquema e do usuário de aplicação.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha SESSION_SECRET e ADMIN_*; use DB_CLIENT=sqlite
npm run dev                  # http://localhost:3000
npm test                     # testes unitários
```

## Estrutura

```
app/                 telas (App Router) e rotas da API em app/api
components/          formulário de entrega e lista de dispensações
lib/config.ts        leitura e validação das variáveis de ambiente
lib/auth.ts          sessão, autorização por papel e tratamento de erros das rotas
lib/sessao-token.ts  assinatura/verificação do cookie de sessão
lib/db-adapter.ts    camada única de acesso a dados (parâmetros vinculados)
lib/db-oracle.ts     driver Oracle · lib/db-postgres.ts · lib/db.ts (SQLite, dev)
lib/auditoria.ts     trilha de auditoria
lib/validacao.ts     validação de entrada
proxy.ts             cabeçalhos de segurança, CSRF, sessão e expiração por inatividade
db/oracle/           DDL e permissões para o DBA
deploy/              modelos de serviço systemd e nginx
tests/               testes unitários
```
