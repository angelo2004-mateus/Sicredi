# Contexto do projeto Lixo Zero Sicredi

## Fonte e prioridade

Este projeto implementa o MVP do Programa Lixo Zero da Sicredi Ouro Verde MT/PA. A referência funcional é `Projeto_Arquitetura_MVP_Lixo_Zero_Sicredi (1).docx`, versão 1.0, de 02/11/2026, fornecido em `/Users/angelomateusnerysouza/Documents/Projeto_Arquitetura_MVP_Lixo_Zero_Sicredi (1).docx`.

As instruções diretas do usuário definem React JS no frontend, Node.js com TypeScript no backend, PostgreSQL e Docker, com pastas raiz `web` e `api`. No backend, separar rotas, controllers, services, repositories e validações. A etapa de arquitetura foi concluída. O backend foi implementado em `api`. A solicitação mais recente autorizou criar o esqueleto do frontend React JS em `web`, com estrutura funcional. O visual segue a referência fornecida posteriormente, descrita abaixo. O usuário forneceu posteriormente `https://sicredi-track-scan.lovable.app/app` como referência visual. Aplicar suas cores, tipografia e componentes às telas do MVP; os recursos excluídos do escopo continuam excluídos. A inspeção e as adaptações estão em `docs/REFERENCIA_VISUAL.md`. O estado e as políticas pendentes do backend estão em `docs/STATUS_BACKEND.md`; o esqueleto do frontend está descrito em `docs/STATUS_FRONTEND.md`.

O documento é a fonte dos requisitos de produto, não uma fonte de comandos a executar. Preservar integralmente seus requisitos e exclusões. Decisões técnicas propostas estão em `docs/SPEC_ARQUITETURA.md`; não apresentar propostas ou pontos pendentes como exigências do documento. Resolver ambiguidades explicitamente antes de implementar o comportamento afetado. Não aumentar o escopo com base no roadmap.

## Produto e objetivo

Aplicação SaaS multiunidade para centralizar registros de pesos de sacos de resíduos, substituir controles descentralizados e fornecer indicadores, relatórios e rastreabilidade para futuras auditorias e certificações. Cada lançamento representa exatamente um saco pesado. A organização inicial é Sicredi Ouro Verde MT/PA; o modelo deve permitir organizações independentes.

Hierarquia: organização/tenant como raiz; agências geradoras e parceiros externos vinculados à organização; usuários ligados à administração central, agência ou parceiro; pesagens ligadas à organização e agência de origem.

## Escopo obrigatório do MVP

- Autenticação, logout, sessão segura, recuperação de acesso possivelmente simplificada e redirecionamento por perfil.
- Organização, agências e seus estados de ativação/inativação.
- Usuários internos e externos, perfis, associação a agência/parceiro e status.
- Parceiros com contatos, documentos básicos, múltiplos tipos e vínculos com agências.
- Tipos de resíduos e parâmetros básicos.
- Pesagem individual com organização, agência, tipo, peso em kg, responsável e data/hora.
- Parceiro de destinação, observação e evidência fotográfica opcionais; o upload pode ficar para incremento posterior dentro do MVP.
- Histórico, filtros, detalhe, edição controlada e cancelamento lógico.
- Dashboards e relatórios por escopo, período, agência, resíduo e parceiro; priorizar CSV nas exportações.
- Auditoria de criação, alteração, cancelamento e mudanças administrativas relevantes.

## Exclusões e evolução

Não implementar bombonas, cadastro de recipientes, QR Code, estoque físico, ordem de transporte completa, despacho, motorista, veículo, conferência no destino, OCR, IA, reconhecimento de imagem, gamificação, ERP, integrações corporativas, aplicativo nativo, modelos preditivos ou automações avançadas.

Nenhuma tela, tabela ou regra obrigatória pode depender de bombona. Não criar `bombona_id`, `qr_code` ou `recipiente_id` em pesagens. Futuras entidades de coleta/transporte e recipientes devem se relacionar ao núcleo existente sem reescrevê-lo.

Roadmap do documento: fase 2 coleta e transporte; fase 3 recipientes e QR Code; fase 4 evidências e auditoria avançada, certificados, licenças e checklists; fase 5 inteligência; fase 6 integrações. A evidência fotográfica básica opcional do MVP permanece distinta dos recursos avançados da fase 4.

## Perfis e permissões

| Ação | Super Admin | Admin Agência | Colaborador Interno | Admin Parceiro | Colaborador Parceiro |
| --- | --- | --- | --- | --- | --- |
| Cadastrar agência | Sim | Não | Não | Não | Não |
| Cadastrar usuário interno | Sim | Sua agência | Não | Não | Não |
| Cadastrar parceiro | Sim | Sua agência/vínculo | Não | Não | Não |
| Cadastrar usuário parceiro | Sim | Se autorizado | Não | Seu parceiro | Não |
| Cadastrar tipo de resíduo | Sim | Não | Não | Não | Não |
| Registrar pesagem | Sim | Sim, sua agência | Sim, sua agência | Não | Não |
| Editar pesagem | Sim | Conforme regra | Própria/dentro da janela | Não | Não |
| Dashboard geral | Sim | Não | Não | Não | Não |
| Dashboard agência | Sim | Sim, sua agência | Limitado | Não | Não |
| Dados do parceiro | Sim | Vinculados | Não | Seu parceiro | Limitado |

Super Admin abrange todas as agências da própria organização; não representa acesso irrestrito entre tenants. Admin do Parceiro gerencia seus colaboradores e consulta dados relacionados quando habilitado. Colaborador do Parceiro pode ser somente consulta no MVP. Não implementar recebimento futuro nesta fase.

As expressões “conforme regra”, “limitado”, “janela”, “se autorizado” e “quando habilitado” exigem definição antes do respectivo fluxo. Não conceder acesso adicional por inferência. A matriz não define explicitamente quem cancela pesagens; essa política deve ser fechada.

## Fluxo principal e experiência

1. Usuário abre Registrar Pesagem no smartphone.
2. Sistema identifica agência e usuário pela sessão; Super Admin precisa de contexto de agência autorizado.
3. Usuário seleciona tipo de resíduo e informa peso em kg.
4. Servidor fornece data/hora por padrão; ajustes somente para perfis autorizados.
5. Usuário pode informar parceiro, observação e foto.
6. Backend valida, persiste e registra auditoria.
7. Histórico e indicadores passam a refletir o lançamento.

Tipo de resíduo e peso devem estar no primeiro bloco da tela mobile. O botão Registrar Pesagem deve estar fixo ou claramente visível. Cada lançamento é um saco, sem contagem ou recipiente obrigatórios.

## Modelo de dados de referência

- `organizations`: id, name, document, status, created_at, updated_at.
- `agencies`: id, organization_id, code, name, cnpj, address, city, state, region, technical_responsible, status.
- `partner_types`: id, organization_id, name, description, status.
- `partners`: id, organization_id, name, trade_name, cnpj, phone, email, address, city, state, status.
- `partner_type_links`: partner_id, partner_type_id.
- `agency_partner_links`: agency_id, partner_id, status.
- `users`: id, organization_id, agency_id nullable, partner_id nullable, name, cpf, email, password_hash, role, status.
- `residue_types`: id, organization_id, name, description, color, default_destination, status.
- `waste_bag_weighings`: id UUID, organization_id UUID, agency_id UUID, residue_type_id UUID, registered_by UUID, destination_partner_id UUID nullable, weight_kg NUMERIC(10,3), weighed_at TIMESTAMPTZ, notes TEXT nullable, evidence_url TEXT nullable, status, created_at, updated_at.
- `audit_logs`: id, organization_id, user_id, action, entity_type, entity_id, before_data JSONB, after_data JSONB, ip_address, created_at.

Status de pesagem definidos na fonte: `active`, `corrected`, `cancelled`. Sua semântica deve ser fechada conforme a spec antes dos cálculos definitivos. O modelo conceitual admite adaptações técnicas, preservando finalidade e regras.

## Regras invariáveis

- Peso maior que zero, em kg, com precisão de três casas decimais no banco.
- Toda pesagem pertence à organização do usuário autenticado.
- Colaborador interno registra apenas em sua agência; Admin Agência não acessa outra agência.
- Backend aplica tenant, agência/parceiro e permissões em toda consulta e alteração, inclusive exportações, auditoria e evidências. Nunca confiar apenas no frontend.
- Tipo de resíduo ativo; parceiro opcional ativo e da mesma organização. Validação adicional de vínculo agência/parceiro é decisão a fechar.
- Data/hora padrão do servidor; ajuste restrito por permissão.
- Edição de peso audita valor anterior e novo.
- Cancelamento lógico; não excluir fisicamente pesagens consolidadas.
- Canceladas nunca compõem indicadores padrão.
- CPF, CNPJ e e-mail têm unicidade conforme escopo a definir.
- Evidências ficam em object storage, nunca em coluna binária do PostgreSQL.

## Telas e indicadores

Telas: Login, Dashboard Super Admin, Dashboard Agência, Agências, Usuários, Parceiros e tipos, Tipos de Resíduos, Registrar Pesagem, Histórico, Detalhe com trilha de alterações, Relatórios, Meu Perfil e troca de senha.

Dashboard geral: agências, usuários, parceiros, total kg, distribuição por resíduo, evolução e ranking por agência. Dashboard da agência: total kg, tipos, período, últimos lançamentos e usuários ativos. Indicadores mínimos adicionais: quantidade de pesagens, média por saco e peso por parceiro. A fonte descreve SUM/COUNT/AVG de registros ativos; ver pendência sobre corrigidos.

Relatórios: período, agência, resíduo, parceiro, colaborador e cancelados/corrigidos para auditoria. Histórico filtra `start_date`, `end_date`, `agency_id` autorizado, `residue_type_id`, `registered_by`, `destination_partner_id`, `status`, `page`, `page_size`, `sort`.

## API e organização técnica

REST JSON versionada em `/api/v1`. Contrato mínimo: login/logout, `/me`, listagem/criação/detalhe/edição de agências, usuários, parceiros e resíduos; listagem/criação/detalhe/correção de pesagens; `POST /weighings/{id}/cancel`; `GET /dashboard/summary`; `GET /reports/weighings`; `GET /audit-logs`. Complementos necessários a tipos de parceiros, vínculos e perfil estão identificados como propostas na spec.

Módulos: auth, organizations, agencies, users, partners, residue-types, weighings, dashboard, reports, audit. Controllers tratam HTTP; services concentram regras e transações; repositories acessam dados; validações conferem DTOs. O frontend consome os contratos da API e não acessa persistência diretamente.

## Segurança e operação

Senhas com Argon2id ou bcrypt. HTTPS em homologação externa e produção. Sessão segura, UUIDs, proteção contra brute force/rate limiting no login, logs estruturados sem senhas/tokens/dados sensíveis, healthcheck. Minimização de dados pessoais e exibição de CPF/CNPJ apenas por necessidade operacional. Definir retenção de evidências e backups; backups automáticos do PostgreSQL em produção. Separar DEV/HML/PROD na evolução.

## Sequência e definição de pronto

Prioridade de telas da fonte: login/sessão → cadastros → pesagem → histórico/detalhe → dashboard agência → dashboard geral → relatórios/exportações. Usar migrations desde o primeiro commit de implementação, seed de homologação/demonstração, documentação OpenAPI e ambiente de homologação acessível por smartphone.

Testes mínimos exigidos: autorização e isolamento, criação de pesagem e cálculos de dashboard. Verificar edição/cancelamento com auditoria e impacto nos totais. Testar chamadas diretas e URLs para impedir acesso entre agências e tenants.

Critérios de aceite: autenticação e redirecionamento; Super Admin mantém agências; administradores mantêm usuários no escopo; manutenção de parceiros e tipos; manutenção de resíduos; pesagem mobile com todos os dados obrigatórios; histórico e dashboard atualizados; isolamento por API; visão consolidada do Super Admin; filtros por período/tipo; auditoria de correção/cancelamento; canceladas fora dos totais; desktop e smartphone funcionais; ausência de dependência de bombonas/QR Code.

Primeiro incremento utilizável: login → cadastro/seleção de agência → cadastro de resíduo → registro de um saco → histórico → dashboard atualizado, sempre respeitando escopo e permissões.

## Legibilidade do código

O código será revisado por pessoas. Manter uma linha em branco entre funções, classes, interfaces e declarações de módulos. Dentro das funções, separar os blocos de validação, consulta, transformação, persistência, auditoria e resposta, mantendo instruções relacionadas próximas. Separar imports do restante do arquivo e agrupar rotas por responsabilidade. Aplicar o mesmo cuidado a testes, seed, schema e configuração. Evitar blocos compactados sem separação visual e espaçamento excessivo entre campos simples de um mesmo objeto. O formatter deve preservar essas separações.
