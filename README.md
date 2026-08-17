# Controle de Psicotrópicos — Farmácia

Sistema interno para controle de dispensação de caixas de psicotrópicos na farmácia hospitalar: registro de entrega/devolução por anestesista, código de caixa e aviso cirúrgico, com histórico permanente, controle de usuários e relatórios.

## O que o sistema faz

- **Tela do dia**: tabela com todas as dispensações do dia, com formulário rápido de registro (campo do crachá com foco automático, pronto para o leitor infravermelho).
- **Leitor de crachá do anestesista**: como o leitor emula teclado (HID), basta o campo estar em foco — a leitura cai direto no campo, sem hardware adicional ou driver. O nome do anestesista aparece automaticamente assim que o crachá é reconhecido.
- **Anestesista precisa estar cadastrado**: se o crachá lido não corresponder a um anestesista vinculado em Administração → Anestesistas, o sistema **bloqueia o registro** da dispensação até que um administrador faça esse cadastro. Isso garante que nenhuma caixa saia da farmácia sem se saber para quem foi.
- **Devolução**: um clique registra o horário de devolução da caixa.
- **Horários em fuso de Brasília**: todos os horários exibidos (tela do dia e relatórios) são convertidos para GMT-3, no formato `17/08/2026 - 15:35`.
- **Usuários com login individual**: cada funcionário da farmácia tem seu próprio usuário/senha. Toda entrega e devolução fica associada a quem a registrou.
- **Dois níveis de acesso**:
  - **Funcionário**: registra entregas e devoluções. Não pode corrigir nem excluir registros já salvos.
  - **Administrador**: além de tudo que o funcionário faz, pode corrigir qualquer campo (com histórico completo de quem alterou o quê), excluir registros de verdade, cadastrar/editar o vínculo crachá→nome dos anestesistas, e criar/gerenciar os logins da equipe.
- **Relatórios**: lista todas as dispensações do período selecionado (data De/Até), com caixa, anestesista, aviso cirúrgico, horário de dispensação e devolução, funcionário responsável e status (em posse / devolvida). Exportação em CSV com as mesmas colunas.

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. Na primeira vez que o sistema roda, ele cria automaticamente um usuário administrador com as credenciais definidas em `.env.local`:

```
ADMIN_LOGIN=admin
ADMIN_SENHA=admin123
```

**Troque essa senha assim que possível** pela tela de Administração → Usuários, e crie os logins de cada funcionário da farmácia por lá.

Localmente, o sistema usa um banco SQLite (arquivo `data/farmacia.db`, criado automaticamente). Não precisa configurar nada além disso.

## Colocando no ar (deploy)

O site foi pensado para rodar de graça na **Vercel** (hospedagem) + **Neon** (banco de dados Postgres).

### Passo 1 — Criar o banco de dados (Neon)

1. Acesse [neon.com](https://neon.com) e crie uma conta gratuita.
2. Crie um novo projeto.
3. Copie a **connection string** (algo como `postgresql://usuario:senha@ep-xxxx.neon.tech/neondb?sslmode=require`).

### Passo 2 — Subir o código no GitHub

```bash
git init
git add .
git commit -m "Sistema de controle de psicotrópicos"
git branch -M main
git remote add origin <URL_DO_SEU_REPOSITORIO>
git push -u origin main
```

### Passo 3 — Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com), crie uma conta (pode ser com GitHub).
2. **Add New → Project**, selecione o repositório.
3. Configure as **variáveis de ambiente** (aba Environment Variables) antes de clicar em Deploy:
   - `POSTGRES_URL` → connection string do Neon
   - `APP_PASSWORD_HASH_SECRET` → uma string aleatória (rode `openssl rand -hex 32` no terminal)
   - `ADMIN_LOGIN` → o login que você quer usar como administrador principal
   - `ADMIN_SENHA` → a senha desse admin (troque depois pelo próprio sistema, se quiser)
   - `ADMIN_NOME` → seu nome ou "Administrador"
4. Clique em **Deploy**. Em ~2 minutos o site estará em `seu-projeto.vercel.app`.

### Passo 4 — Primeiro acesso

Acesse o site, faça login com o `ADMIN_LOGIN`/`ADMIN_SENHA` configurados. Vá em **Administração**:
- Em **Usuários**, crie um login para cada funcionário da farmácia.
- Em **Anestesistas**, vincule os códigos de crachá aos nomes.

## Sobre o leitor de crachá

Não precisa de nenhuma integração especial: leitores infravermelho de crachá que emulam teclado (HID) funcionam como um leitor de código de barras comum. Basta o campo estar em foco (já acontece automaticamente) e aproximar o crachá.

## Sobre rastreabilidade e permissões

- Funcionários nunca corrigem ou excluem registros — só registram entrega e devolução. Isso preserva a integridade do que foi digitado no momento da dispensação.
- Administradores podem corrigir erros de digitação, mas cada correção fica registrada num histórico (campo alterado, valor antigo, valor novo, quem alterou, quando).
- Administradores podem excluir registros de verdade — use com cautela, pois essa ação não fica em histórico (diferente da correção).
- Todo registro guarda o nome de quem entregou e de quem devolveu.

Vale avaliar com a equipe de compliance/farmácia se há exigências adicionais da Vigilância Sanitária ou da Portaria 344/98 da ANVISA para este tipo de controle eletrônico — este sistema foi desenhado para as necessidades operacionais descritas, não como consultoria regulatória.

## Estrutura do projeto

```
app/
  page.tsx                          → tela principal (tabela do dia + formulário)
  login/page.tsx                     → tela de login (usuário + senha)
  relatorios/page.tsx                → tela de relatórios
  admin/page.tsx                     → índice da área administrativa
  admin/anestesistas/page.tsx        → cadastro crachá → nome
  admin/usuarios/page.tsx            → gerenciamento de logins da equipe
  api/
    dispensacoes/                    → registrar/listar entregas
    dispensacoes/[id]/                → editar (admin) / excluir (admin)
    dispensacoes/[id]/devolucao/      → registrar devolução
    anestesistas/                     → leitura pública (resolver nome ao ler crachá)
    admin/anestesistas/                → CRUD de anestesistas (admin)
    admin/usuarios/                    → CRUD de usuários (admin)
    relatorios/                        → relatórios agregados
    auth/                              → login/logout/sessão
components/
  FormularioEntrega.tsx              → formulário de nova entrega
  TabelaDispensacoes.tsx             → tabela com edição/devolução/exclusão
lib/
  db.ts                              → banco SQLite (desenvolvimento local, via node:sqlite nativo)
  db-postgres.ts                     → banco Postgres (produção)
  db-adapter.ts                      → escolhe automaticamente qual usar
  auth.ts                            → sessão de login (Node runtime)
  usuarios.ts                        → lógica de autenticação e CRUD de usuários
  useSessao.ts                       → hook React para consumir a sessão no frontend
middleware.ts                        → protege rotas e checa papel admin (Edge runtime)
```
