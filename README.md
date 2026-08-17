# Controle de Psicotrópicos — Farmácia

Sistema interno para controle de dispensação de caixas de psicotrópicos na farmácia hospitalar: registro de entrega/devolução por anestesista, setor do hospital, código de caixa e atendimento, com histórico permanente, controle de usuários e relatórios.

## O que o sistema faz

- **Abas por setor**: a tela principal é organizada em abas (Centro Cirúrgico 1, Centro Cirúrgico 2, Hemodinâmica, Endoscopias, por padrão) — cada dispensação fica associada ao setor selecionado na aba ativa. Os setores são gerenciáveis por administradores.
- **Tela do dia**: dentro de cada aba, uma tabela com todas as dispensações do dia daquele setor, com formulário rápido de registro (campo do crachá com foco automático, pronto para o leitor infravermelho).
- **Leitor de crachá do anestesista**: como o leitor emula teclado (HID), basta o campo estar em foco — a leitura cai direto no campo, sem hardware adicional ou driver. O nome do anestesista aparece automaticamente assim que o crachá é reconhecido.
- **Anestesista precisa estar cadastrado**: se o crachá lido não corresponder a um anestesista vinculado em Administração → Anestesistas, o sistema **bloqueia o registro** da dispensação até que um administrador faça esse cadastro.
- **Devolução**: um clique registra o horário de devolução da caixa.
- **Horários em fuso de Brasília**: todos os horários exibidos (tela do dia e relatórios) são convertidos para GMT-3, no formato `17/08/2026 - 15:35`.
- **Usuários com login individual**: cada funcionário da farmácia tem seu próprio usuário/senha. Toda entrega e devolução fica associada a quem a registrou.
- **Dois níveis de acesso**:
  - **Funcionário**: registra entregas e devoluções em qualquer setor. Não pode corrigir nem excluir registros já salvos, nem gerenciar setores/anestesistas/usuários.
  - **Administrador**: além de tudo que o funcionário faz, pode corrigir qualquer campo (com histórico completo de quem alterou o quê), excluir registros de verdade, e gerenciar setores, anestesistas e logins da equipe em Administração.
- **Relatórios**: lista todas as dispensações do período selecionado (data De/Até), com setor, caixa, anestesista, atendimento, horário de dispensação e devolução, funcionário responsável e status (em posse / devolvida). Exportação em **CSV** ou **Excel (.xlsx)**, com as mesmas colunas.

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. Na primeira vez que o sistema roda, ele cria automaticamente:
- um usuário administrador, com as credenciais definidas em `.env.local` (`ADMIN_LOGIN` / `ADMIN_SENHA`);
- os 4 setores padrão (Centro Cirúrgico 1, Centro Cirúrgico 2, Hemodinâmica, Endoscopias) — que podem ser renomeados, removidos ou complementados depois em Administração → Setores.

**Troque a senha do admin assim que possível** pela tela de Administração → Usuários, e crie os logins de cada funcionário da farmácia por lá.

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

Para atualizações futuras, depois da primeira vez: `git add .`, `git commit -m "descrição"`, `git push` — a Vercel atualiza sozinha em ~1 minuto.

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
- Em **Setores**, confira/ajuste os setores padrão que já vêm cadastrados.
- Em **Usuários**, crie um login para cada funcionário da farmácia.
- Em **Anestesistas**, vincule os códigos de crachá aos nomes.

## Sobre o leitor de crachá

Não precisa de nenhuma integração especial: leitores infravermelho de crachá que emulam teclado (HID) funcionam como um leitor de código de barras comum. Basta o campo estar em foco (já acontece automaticamente) e aproximar o crachá.

## Sobre rastreabilidade e permissões

- Funcionários nunca corrigem ou excluem registros — só registram entrega e devolução, em qualquer setor. Isso preserva a integridade do que foi digitado no momento da dispensação.
- Administradores podem corrigir erros de digitação, mas cada correção fica registrada num histórico (campo alterado, valor antigo, valor novo, quem alterou, quando).
- Administradores podem excluir registros de verdade — use com cautela, pois essa ação não fica em histórico (diferente da correção).
- Remover um setor ou um anestesista em Administração não apaga nem corrompe dispensações já registradas — o nome fica preservado no registro histórico, mesmo que o cadastro original seja removido depois.
- Todo registro guarda o nome de quem entregou e de quem devolveu, e o setor onde a dispensação ocorreu.

Vale avaliar com a equipe de compliance/farmácia se há exigências adicionais da Vigilância Sanitária ou da Portaria 344/98 da ANVISA para este tipo de controle eletrônico — este sistema foi desenhado para as necessidades operacionais descritas, não como consultoria regulatória.

## Estrutura do projeto

```
app/
  page.tsx                          → tela principal (abas de setor + tabela do dia + formulário)
  login/page.tsx                     → tela de login (usuário + senha)
  relatorios/page.tsx                → tela de relatórios (CSV e Excel)
  admin/page.tsx                     → índice da área administrativa
  admin/anestesistas/page.tsx        → cadastro crachá → nome
  admin/setores/page.tsx             → gerenciamento das abas de setor
  admin/usuarios/page.tsx            → gerenciamento de logins da equipe
  api/
    dispensacoes/                    → registrar/listar entregas (filtráveis por data e setor)
    dispensacoes/[id]/                → editar (admin) / excluir (admin)
    dispensacoes/[id]/devolucao/      → registrar devolução
    anestesistas/                     → leitura pública (resolver nome ao ler crachá)
    setores/                          → leitura pública (abas visíveis a todos)
    admin/anestesistas/                → CRUD de anestesistas (admin)
    admin/setores/                     → CRUD de setores (admin)
    admin/usuarios/                    → CRUD de usuários (admin)
    auth/                              → login/logout/sessão
components/
  FormularioEntrega.tsx              → formulário de nova entrega (dentro do setor ativo)
  TabelaDispensacoes.tsx             → tabela com edição/devolução/exclusão
lib/
  db.ts                              → banco SQLite (desenvolvimento local, via node:sqlite nativo)
  db-postgres.ts                     → banco Postgres (produção)
  db-adapter.ts                      → escolhe automaticamente qual usar
  auth.ts                            → sessão de login (Node runtime)
  usuarios.ts                        → lógica de autenticação e CRUD de usuários
  setores.ts                         → seed inicial dos setores padrão
  formatarData.ts                    → formatação de datas/horas em fuso de Brasília
  useSessao.ts                       → hook React para consumir a sessão no frontend
middleware.ts                        → protege rotas e checa papel admin (Edge runtime)
```
