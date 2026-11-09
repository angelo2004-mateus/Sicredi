# Referência visual do frontend

Referência fornecida pelo usuário: https://sicredi-track-scan.lovable.app/app. Inspeção autenticada realizada em 08/11/2026, com navegação pelo login, dashboard, agências, usuários, parceiros, tipos de resíduos, tipos de parceiros e perfil. A lista operacional foi observada para aplicar seus padrões ao histórico de pesagens. Nenhum cadastro foi alterado na referência.

## Valores observados

- Fonte: `ui-sans-serif, system-ui, sans-serif`, com os fallbacks de emoji do sistema.
- Cor principal: `oklch(62.6% .191 138.8)`.
- Menu lateral: `oklch(47.4% .119 151)`; seleção: `oklch(52% .12 148)`.
- Texto: `oklch(32% .03 145)`; secundário: `oklch(49.1% .02 145.3)`.
- Bordas: `oklch(90% .03 129)`; fundo e cards brancos.
- Menu: 256 px, com grupos em caixa alta, ícones de 18 px, itens de 36 px, conta e saída na base, versão e controle de recolhimento.
- Cabeçalho: 48 px, título de 15 px, badge de perfil, escopo, alternância de tema e acesso ao perfil.
- Conteúdo: padding de 16 px no celular, 24 px no tablet e 32 px no desktop.
- Títulos das páginas: 24/32 px, peso 700 e espaçamento de letras de -0,025 em.
- Inputs e botões: 36 px, fonte de 14 px e raio de 4 px; botão de login de 44 px.
- Login: duas colunas, imagem com gradiente verde, marca sobre fundo branco, título de 36/45 px e formulário centralizado; somente formulário no celular.
- Cadastros: resumo em três cards, busca e filtros, tabelas com status e ações; tipos apresentados em cards.
- Formulários: modal com menu de etapas, indicador de progresso, conteúdo, revisão e ações no rodapé; foco e Escape controlados pelo elemento `dialog` nativo.
- Tema escuro: cores extraídas da referência e aplicadas por variáveis; apenas a preferência de tema é persistida no navegador.

## Imagens e ícones

`web/public/images/sicredi-logo.png`, `login-bg.jpg` e `catavento.svg` foram obtidos dos recursos observados no site de referência. Os ícones presentes no menu e componentes correspondentes usam os mesmos caminhos SVG observados, consolidados em `web/src/components/icons.json`. Ícones adicionais atendem às funcionalidades próprias do MVP. Nenhum script, credencial, sessão ou dado cadastral da referência foi incorporado ao projeto.

## Aplicação ao escopo do MVP

A identidade visual foi aplicada às telas já existentes. O conteúdo continua refletindo o documento do MVP: um saco por pesagem, dados reais da API e permissões por organização/agência/parceiro. Os textos e indicadores que na referência tratam de bombonas, QR Code, prontidão, plano de ação ou transporte foram adaptados ao escopo de pesagens, ou seus módulos foram omitidos. Esses recursos continuam fora do escopo autorizado. A tela de perfil mantém a edição de nome existente.

A composição resultante não é uma cópia integral de todas as páginas da referência: usa seus valores visuais e componentes nas funcionalidades do MVP. Não foi realizada comparação automatizada pixel a pixel. Dados, quantidade de linhas, nomes e métricas variam conforme o banco e o perfil autenticado.

## Validação

Build de produção e formatação verificados. Navegador validado com API e PostgreSQL separados da instalação principal: login, criação de agência em três etapas, edição de usuário mantendo role/senha, registro e detalhe de pesagem, atualização do dashboard com gráficos, consultas de cadastro, tema escuro e navegação móvel. O banco principal não recebeu os registros de teste. As regras de negócio e as permissões da API permanecem inalteradas.
