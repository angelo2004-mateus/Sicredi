# Esqueleto do frontend

O usuário autorizou iniciar o frontend em React JS e depois forneceu a referência visual. A entrega inicial e a evolução estão registradas abaixo; o estado visual atual está em `REFERENCIA_VISUAL.md`. A implementação está em `web`, com Vite, React Router e TanStack Query. O padrão de espaçamento solicitado para revisão humana também se aplica ao frontend.

## Entrega inicial

- Estrutura em `app`, `pages`, `components`, `layouts`, `hooks`, `services`, `utils` e `styles`.
- Rotas protegidas, login/logout, recuperação de sessão e menu conforme permissões de `/me`.
- Cliente HTTP centralizado, cookies HttpOnly controlados pela API e token CSRF somente em memória. Nenhuma senha/token em localStorage.
- Visão geral com métricas reais; início alternativo para perfis sem dashboard.
- Registro de um saco com seleção de resíduo, peso em kg, agência para Super Admin e parceiro/observação opcionais.
- Histórico e relatórios com filtros de datas/status, paginação, detalhe e exportação CSV.
- Consulta, busca, paginação, cadastro, edição e ativação/inativação de agências, usuários, parceiros, tipos de parceiros e resíduos, conforme perfil.
- Perfil com consulta e atualização do nome.
- Estados de carregamento, ausência de dados, acesso indisponível e erro com tentativa de recuperação.
- CSS básico responsivo e serviço Docker de desenvolvimento em localhost:5173, com proxy de `/api` para a API.

## Limites deste incremento

O cadastro de usuários já permite escolher a role e o vínculo de agência/parceiro conforme as permissões retornadas pela API. A edição administrativa permite redefinir a senha de outro usuário autorizado; a troca da própria senha pela tela de perfil, edição/cancelamento de pesagens, trilha de auditoria visual, gráficos avançados e upload de evidências ficam para os próximos incrementos. As regras condicionais do backend permanecem inalteradas. O esqueleto não simula usuários, indicadores nem registros.

A referência visual do usuário orientará a etapa posterior de design. Não foi introduzida biblioteca de componentes, imagens, fontes externas ou identidade visual definitiva.

## Validação

Build de produção e conferência de formatação executados. Fluxo validado pelo navegador em ambiente isolado com PostgreSQL e API reais: login, recarga com recuperação de sessão, pesagem fictícia de 8,750 kg, detalhe, atualização do dashboard, logout e novo login sem recarga. Os dados de demonstração usados para essa verificação pertencem somente ao banco de teste. O README descreve como executar e preparar uma conta local via seed.


## Cadastros e perfis de acesso

O usuário solicitou completar os cadastros e o acesso personalizado conforme a spec. Os botões de cadastrar/editar usam `permissions.resources` de `/me`; o seletor de role usa `permissions.assignable_user_roles`. As validações definitivas permanecem no backend. Não existe seleção de tenant no formulário: a organização é sempre derivada da sessão.

| Perfil | Cadastro e escopo |
| --- | --- |
| Super Admin | Agências, usuários com as cinco roles, parceiros, tipos e resíduos da própria organização |
| Admin da Agência | Colaboradores internos da própria agência e cadastro de parceiro com vínculo automático à sua agência |
| Colaborador Interno | Pesagens na própria agência; sem cadastro administrativo ou acesso ao cadastro completo de parceiros |
| Admin do Parceiro | Colaboradores do próprio parceiro |
| Colaborador do Parceiro | Consultas do próprio parceiro quando habilitadas; sem cadastros administrativos |

O formulário de usuário exige agência para perfis internos e parceiro para perfis externos; Super Admin não recebe esses vínculos. Administradores locais só atribuem a role de colaborador do seu escopo. O próprio usuário usa Meu Perfil em vez da edição administrativa, evitando alterar seu próprio perfil/status ou revogar sua sessão por esse caminho.

No formulário do parceiro, Super Admin mantém múltiplas agências e tipos. A API grava os vínculos junto com o cadastro em uma transação e audita o resultado. Vínculos removidos de agência são inativados, preservando histórico. A seleção de parceiros da pesagem usa `/lookups/partners`, restrito a ID/nome/status dos parceiros ativos permitidos, sem documentos ou contatos.

Validação adicional: 48 testes integrados de backend aprovados; navegador validado com dados fictícios em banco separado para criar agência, criar/editar parceiro, recuperar vínculos, selecionar as cinco roles como Super Admin e restringir as opções do Admin da Agência e do Admin do Parceiro. O Colaborador Interno não vê o menu de parceiros, mas continua selecionando parceiros autorizados na pesagem. A instalação principal não recebeu dados desses testes.


## Aplicação da referência visual

A referência visual foi fornecida posteriormente e inspecionada com acesso autorizado. O frontend agora usa as cores, tipografia, imagens e medidas observadas na referência: login em duas colunas, menu verde recolhível, cabeçalho compacto, resumo dos cadastros, filtros, badges, tabelas, cards de tipos, modais de cadastro em etapas, perfil, tema escuro e menu móvel. O dashboard apresenta gráficos com agregados reais da API e filtros por período/resíduo. A busca e os filtros dos cadastros operam sobre as páginas obtidas da API, sempre no escopo autorizado.

`REFERENCIA_VISUAL.md` registra os valores e limites da reprodução. Textos e indicadores foram adaptados ao MVP de pesagens; funcionalidades de bombonas, QR Code e transporte da referência não foram adicionadas. As autorizações e políticas pendentes do backend continuam valendo.

Build, formatação e navegação foram validados, incluindo cadastro de agência, edição de usuário sem alterar role/senha e pesagem fictícia de 8,750 kg em banco isolado, dashboard, tema e comportamento móvel.
