# Lixo Zero Sicredi

Backend do MVP do Programa Lixo Zero da Sicredi Ouro Verde MT/PA. Node.js com TypeScript, Express, Prisma e PostgreSQL, com organização em rotas, controllers, services, repositories, validações e policies. O frontend inicial em React JS está em `web`, com identidade visual aplicada a partir da referência fornecida pelo usuário.

## Executar com Docker

Requisitos: Docker e Docker Compose. Na raiz do projeto:

```sh
cp .env.example .env
docker compose up --build -d
```

O Compose inicia PostgreSQL, executa as migrations, inicia a API e disponibiliza o frontend em `http://localhost:5173`. A porta do banco não é publicada; a API fica em `http://localhost:3000`. O arquivo `.env` é local e ignorado pelo Git. Os valores de demonstração não devem ser usados em ambientes externos.

- `GET /health/live`: processo ativo.
- `GET /health/ready`: acesso ao banco disponível.
- `GET /api/v1/openapi.json`: contrato OpenAPI 3.1 com rotas, payloads e filtros.

O Compose fornecido é de desenvolvimento. Homologação externa e produção exigem proxy HTTPS, `APP_ORIGIN` correto, credenciais próprias, backups automáticos e política de retenção/recuperação. Em produção, configurar `NODE_ENV=production`. A API não pressupõe confiança em cabeçalhos de proxy; ajustar `trust proxy` apenas para uma topologia conhecida antes de publicar.

## Dados de demonstração

Seed é opt-in, não executado automaticamente e proibido com `NODE_ENV=production`. Defina `SEED_PASSWORD` no ambiente do terminal com uma senha local de pelo menos 12 caracteres, depois execute:

```sh
docker compose run --rm -e ALLOW_DEMO_SEED=true -e SEED_PASSWORD api npm run db:seed
```

O seed cria a organização de demonstração, duas agências, um parceiro, tipo de parceiro, tipo de resíduo e as contas abaixo. Todos os dados são fictícios; CPF e CNPJ permanecem vazios. Rodar novamente não altera senhas nem cadastros existentes.

| Conta | Perfil |
| --- | --- |
| superadmin@demo.invalid | Super Admin |
| admin.a@demo.invalid | Admin Agência A |
| colaborador.a@demo.invalid | Colaborador Agência A |
| admin.b@demo.invalid | Admin Agência B |
| admin.parceiro@demo.invalid | Admin Parceiro |
| colaborador.parceiro@demo.invalid | Colaborador Parceiro |

IDs úteis: agência A `00000000-0000-4000-8000-000000000002`; agência B `00000000-0000-4000-8000-000000000003`; parceiro `00000000-0000-4000-8000-000000000004`; resíduo Papel `00000000-0000-4000-8000-000000000005`.

## Desenvolvimento local

Node.js 22.19 ou superior e PostgreSQL acessível. Os comandos são executados dentro de `api`:

```sh
npm ci
cp .env.example .env
# Ajuste DATABASE_URL e APP_ORIGIN no .env
npm run db:generate
npm run db:migrate
npm run dev
```

O Compose padrão não publica PostgreSQL. Para desenvolvimento local, use um PostgreSQL próprio ou um override Compose que publique a porta somente em localhost. O banco de testes separado é iniciado pelo script da seção seguinte.

`npm run build` compila e `npm start` executa o código compilado. Não use `prisma db push` como substituto das migrations: as chaves estrangeiras compostas e constraints complementares estão no SQL versionado. Novas migrations devem preservar essas constraints; os modelos escalares Prisma não as descrevem integralmente.

## Autenticação e consumo

1. `POST /api/v1/auth/login` com `email` e `password` retorna `csrf_token`, expiração e cookie `session` HttpOnly.
2. Envie o cookie nas próximas chamadas. Todas as mutações autenticadas exigem o cabeçalho `X-CSRF-Token` com o token retornado.
3. `GET /api/v1/me` retorna identidade e permissões efetivas. Após recarregar o cliente, `GET /api/v1/auth/csrf` retorna um novo token e invalida o anterior.
4. `POST /api/v1/auth/logout` revoga a sessão. `POST /api/v1/me/password` exige senha atual, troca a senha e revoga todas as sessões.

A recuperação simplificada é administrativa: um administrador autorizado pode redefinir `password` via `PATCH /users/{id}` dentro do seu escopo; isso revoga as sessões do usuário e audita a alteração sem registrar a senha. Não há integração de e-mail nem endpoint público de recuperação nesta entrega. O procedimento de verificação de identidade e comunicação de senha temporária continua sendo operacional, fora da API.

Login tem limite de tentativas malsucedidas por IP. Sessões duram 12 horas por padrão e guardam apenas hashes dos identificadores no banco. Senhas usam Argon2id. Sem `Origin`, clientes de servidor/CLI são aceitos com cookie e CSRF; origens de navegador diferentes de `APP_ORIGIN` são rejeitadas nas mutações.

## Recursos implementados

- Organização atual; agências; usuários e perfis; parceiros, tipos e vínculos; tipos de resíduos; ativação/inativação via PATCH.
- Pesagem individual em kg, com autoria/tenant derivados da sessão e horário do servidor por padrão.
- Histórico paginado, detalhe, filtros e trilha de auditoria da pesagem.
- Correção com versão otimista e cancelamento lógico com motivo, sujeitos às políticas abaixo.
- Dashboard com soma, contagem, média, agrupamentos por agência/resíduo/parceiro/período, ranking, últimos lançamentos e contadores.
- Relatórios JSON com totalizações e CSV em lotes, aplicando o escopo e protegendo conteúdo contra fórmulas de planilha.
- Auditoria administrativa e operacional transacional e imutável pela aplicação.

A API nunca aceita tenant/autoria do frontend. Super Admin enxerga somente sua organização; Admin Agência somente sua unidade. Usuários internos de agência têm agência derivada da sessão. Usuários parceiros não criam pesagens. Cadastros de usuários não permitem elevação de perfil por administradores locais. Alterações administrativas de usuário revogam suas sessões.

`weight_kg` aceita número JSON ou string decimal positiva, até 7 dígitos inteiros e 3 casas decimais. Respostas usam strings decimais para preservar precisão. Datas de filtro devem ser ISO 8601 com timezone; intervalos são `[start_date, end_date)`. Séries do dashboard são agrupadas em UTC, indicado na resposta; a apresentação local pertence ao futuro frontend.

Histórico sem filtro mostra todos os status. Relatórios, por padrão, usam os status incluídos nos indicadores; um filtro explícito `status` permite consultar canceladas/corrigidas. CSV exporta todo o conjunto filtrado em ordem de ID e ignora paginação/ordenação visual. JSON respeita paginação e ordenação. Registros cancelados não compõem indicadores.

Documentos pessoais são opcionais. CPF/CNPJ são normalizados para dígitos e validados por formato; esta entrega não verifica dígitos verificadores nem consulta bases externas. CPF é único por organização em usuários; CNPJ por organização em cada cadastro; e-mail de usuário é único global, sem distinção de caixa na API. A lista/detalhe de usuários não expõe CPF ou hash de senha. A auditoria omite campos de documento, contato, senha e observação livre.

## Políticas ainda pendentes

A spec original deixa políticas de negócio sem definição. Em `api/src/policies/access.ts`, `businessPolicy.confirmed=false` e `partnerReadEnabled=false` mantêm correção/cancelamento e consulta operacional de parceiros bloqueados. As rotas de correção/cancelamento retornam `409 BUSINESS_POLICY_PENDING`. Não se trata de falha técnica nem de permissão concedida.

A política candidata está implementada e testada com ativação restrita aos testes: corrigidas continuam nos totais; Admin Agência corrige/cancela na sua agência; colaborador consulta os próprios registros e corrige por 24 horas; apenas Super Admin altera data/hora; parceiro consulta somente pesagens destinadas a ele. A confirmação do usuário é necessária antes de habilitá-la no código e atualizar os documentos. Até lá, dashboard considera apenas `active`, conforme formulação literal da fonte; a API não produz novas pesagens `corrected`.

Admin Agência pode criar parceiro e vincular parceiros da própria organização à sua agência, mas alterações do cadastro compartilhado e tipos ficam com Super Admin. Admin Agência cria e mantém colaboradores internos; Admin Parceiro cria e mantém colaboradores do seu parceiro. Delegação de novos administradores é central. Vínculo do parceiro com a agência não é obrigatório no lançamento, conforme opção permitida pela fonte; parceiro precisa estar ativo e no mesmo tenant.

Evidências ficam nulas nesta entrega inicial. Upload/object storage, política de retenção de fotos, backups de produção e recuperação por e-mail não foram ativados. Não há PWA, bombonas, QR Code ou transporte. O frontend inicial está descrito na seção abaixo.

## Testes

Na raiz:

```sh
./scripts/test-backend.sh
```

O script inicia PostgreSQL real em porta local 55432 com armazenamento temporário, gera o client, aplica migrations, confere TypeScript e executa a suíte HTTP. O banco de teste é separado do banco do aplicativo. Testes exigem `NODE_ENV=test` e nome de banco com sufixo `_test`; usam dados fictícios com IDs novos e não apagam dados do aplicativo.

A suíte cobre autenticação, CSRF, RBAC, isolamento entre tenants/agências/parceiros, constraints SQL, cadastros, filtros, peso, precisão, auditoria transacional com rollback, cálculos, CSV, correção/cancelamento sob a política candidata e revogação de sessão. Para parar somente a infraestrutura de teste:

```sh
docker compose -f compose.test.yaml down
```

## Documentos do projeto

- `AGENT.md`: contexto e requisitos funcionais.
- `docs/SPEC_ARQUITETURA.md`: arquitetura geral e roteiro.
- `docs/STATUS_BACKEND.md`: estado desta implementação e decisões pendentes.


## Frontend inicial

React JS com Vite, React Router e TanStack Query. O código está separado em `app`, `pages`, `components`, `layouts`, `hooks`, `services`, `utils` e `styles`, preservando linhas em branco entre funções e blocos de responsabilidade.

Com Docker, abra `http://localhost:5173` após `docker compose up --build -d`. Para desenvolver fora do Docker, mantenha a API em execução e rode:

```sh
cd web
npm ci
npm run dev
```

O Vite encaminha `/api` para `http://localhost:3000`; no Compose, encaminha para `http://api:3000`. Não existe URL de API embutida nas telas. Cookies e CSRF passam pelo mesmo endereço do frontend; nenhum token ou senha é gravado em localStorage.

Telas iniciais: login, visão geral com dados reais, formulário de pesagem, histórico, detalhe, cadastros de agências/usuários/parceiros/tipos/resíduos, relatório JSON/CSV e edição do nome no perfil. A navegação usa as permissões de `/me`; restrições definitivas continuam na API. Perfis sem dashboard recebem uma tela de início com acesso às ações permitidas.

O frontend permite consultar, buscar, paginar, cadastrar e editar agências, usuários, parceiros, tipos de parceiros e resíduos conforme as permissões da sessão. Usuários têm seleção de role e vínculo com agência/parceiro; parceiros permitem vínculos com agências e classificação por tipos. Troca da própria senha pela tela de perfil, edição/cancelamento de pesagens e auditoria visual ficam para os próximos incrementos. Não há dados fictícios ou autenticação simulada no frontend. Use o seed do backend com senha definida por você para entrar na instalação local.

O CSS é simples e responsivo, com variáveis básicas e sem biblioteca visual, fontes externas ou imagens. A referência foi fornecida posteriormente; sua aplicação está documentada em `docs/REFERENCIA_VISUAL.md`. Para verificar o código: `npm run build` e `npm run format:check`, dentro de `web`.


### Roles e ações dos cadastros

As cinco roles são `super_admin`, `agency_admin`, `internal_employee`, `partner_admin` e `partner_employee`. A API retorna as ações de cadastro em `GET /api/v1/me`, sob `permissions.resources`, e as roles atribuíveis em `permissions.assignable_user_roles`. O frontend usa essas informações para apresentar os formulários; chamadas diretas à API continuam sujeitas às mesmas regras de escopo e autorização.

Super Admin cadastra agências e atribui as cinco roles dentro da sua organização. Admin Agência gerencia colaboradores internos da sua unidade e cadastra parceiros com vínculo automático. Admin Parceiro gerencia colaboradores do seu parceiro. Colaboradores não possuem ações administrativas. A edição do cadastro compartilhado de parceiros e a delegação de novos administradores permanecem centrais.

`POST/PATCH /partners` aceita `agency_ids` e `partner_type_ids` para Super Admin. Os arrays são validados e persistidos na mesma transação do parceiro. Para a seleção de destinação na pesagem, `GET /lookups/partners` fornece apenas ID, nome e status de parceiros ativos, sempre no escopo do usuário; o Colaborador Interno não acessa o cadastro completo de parceiros.


## Referência visual aplicada

O frontend usa a referência visual fornecida pelo usuário, com menu lateral verde, tema claro/escuro, login com imagem, cards, filtros, tabelas, cadastro em modal com etapas e dashboard com gráficos reais. A navegação respeita os perfis e permanece adaptada ao MVP de pesagens. A origem dos recursos, medidas observadas e limites da reprodução estão em `docs/REFERENCIA_VISUAL.md`.
