# Segurança, publicação e operação

> Complementos vigentes: `06-M1-SEGURANCA-E-LIMITES.md` e `07-M1B-HOMOLOGACAO.md`. Na v0.3.0 as migrations permanecem inalteradas e ainda não foram homologadas em banco real.

## Estado desta entrega

Não houve push para o GitHub, merge, aplicação de migration, deploy Netlify/Edge Function, criação de branch Supabase, alteração de segredo ou mudança de MFA. O código foi desenvolvido em repositório local isolado. Não houve nova inspeção remota na v0.3.0; as observações abaixo são históricas. O pacote não afirma que ações de outras pessoas não tenham alterado o projeto.

A configuração `HELPDESK_RELEASE_APPROVED=false` é deliberada. Não utilizar o site com dados reais apenas porque a interface pode ser construída. A demonstração `npm run demo` escuta somente em loopback e armazena fixtures em memória; ela nunca é fallback do runtime de produção.

## Alertas remotos constatados nas inspeções anteriores

O Security Advisor do projeto `xaelbntjnvztznnpcvtm` retornou dois avisos para `public.rls_auto_enable()`: execução como SECURITY DEFINER por `anon` e por `authenticated`. Não foi obtido o corpo da função nesta inspeção. A migration `20260915000100_restrict_existing_definer.sql` propõe revogar EXECUTE de PUBLIC/anon/authenticated, preservando corpo, função e eventuais usos internos. Ela verifica a existência do objeto antes de agir. Deve ser aplicada pelo fluxo de migrations autorizado e seguida de nova consulta ao Advisor e teste do recurso ao qual a função pertence.

Referências de remediação:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Modelo de ameaças resumido

| Ameaça | Controle já codificado | Gate adicional |
|---|---|---|
| Troca de ID para ler outro cliente/workspace | Autorização de objeto, filtros SQL, RLS e FKs candidatas | Testar em PostgreSQL real e em todos os futuros endpoints. |
| Notas internas em resposta/arquivo/webhook | Tabela/endpoint/serializer separados; sem outbox da nota | Repetir cobertura quando busca, exportação e anexos existirem. |
| Header de workspace tratado como autoridade | Bearer validado + vínculo vivo no banco | Ensaiar revogação e trocas de sessão no host real. |
| Credencial M2M no browser | Segredo apenas no backend; troca por sessão curta | Protocolo por pessoa para suporte incorporado. |
| Vazamento do contexto no pool | Contexto SET LOCAL + rollback/release | Teste real com conexões reutilizadas e timeout. |
| Dois tickets por reenvio | Registro único e lock de idempotência | Concorrência real, retries após commit e lifecycle dos registros. |
| Chamado sem intenção de notificação | Unidade transacional + trigger diferida candidata | Teste da constraint e implementação do worker. |
| Sobrescrita entre agentes | If-Match e incremento de versão | Testes de fluxo no navegador e outras futuras mutações. |
| Backend operando como administrador | Validação do papel no startup; não usa service_role | Revisão dos grants, donos e pooler no ambiente real. |
| Abuso de credenciais/tokens e crescimento | Rate limiter, quotas, lifecycle e limpeza restrita codificados na v0.2.0 | SQL real, teste de abuso/carga, calibração e operação da manutenção pendentes. |
| SSRF/anexo malicioso | Funcionalidades ainda desativadas | Implementar pipeline completo antes de ativar. |
| App/backend comprometido | Menor privilégio e dados segmentados | SQL parametrizado não substitui segurança do runtime, secrets e supply chain. |

RLS desta fundação protege a fronteira de dados; capacidades de cada operação também são verificadas no serviço de aplicação. A revisão real deve verificar escopos de leitura/escrita, relações contratuais futuras e as condições de TOCTOU. Não há pentest independente concluído nesta sessão.

## Pré-publicação: sequência obrigatória

1. Inspecionar novamente o estado remoto e comparar com o pacote. Não sobrescrever trabalho concorrente.
2. Revisar arquitetura, contrato HTTP e escopo do incremento; concluir HD-101/102/103 e os gates de segurança pertinentes.
3. Gerar lockfile auditado em ambiente com registry autorizado; validar o empacotamento real das Functions e a compatibilidade do driver.
4. Executar migrations e validação hospedada diretamente em produção, preservando os dados existentes. Não criar infraestrutura cobrada sem aprovação.
5. Confirmar schemas da Data API, helpers, login da aplicação, pooler e certificados TLS. Não desabilitar verificação TLS para “fazer funcionar”.
6. Provisionar identidades, grants e configurações de teste por procedimento administrativo, não por endpoint de signup privilegiado.
7. Executar API com Supabase Auth e PostgreSQL reais, incluindo suspensão/revogação/isolamento/concorrência.
8. Exercitar navegador, segurança, rate limits, recuperação e a política de sessões. Aprovar requisitos de produção e atualizar evidências por commit.
9. Somente depois configurar release e publicar pelo fluxo autorizado. Manter cópia da versão anterior e estratégia de retorno compatível com o banco.

## Segredos e ambientes

`HELPDESK_RATE_LIMIT_HMAC_KEY`, `HELPDESK_DATABASE_URL` e eventual `HELPDESK_DATABASE_CA` pertencem somente ao backend/Functions. A URL de banco deve usar o login restrito, não `postgres`. A aplicação rejeita parâmetros SSL na URL que possam sobrescrever a verificação configurada pelo driver. Configuração precisa ser conferida contra o connection string real fornecido pelo projeto/pooler.

`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` podem ser retornados ao frontend; uma chave secret/service não pode ocupar esse campo. A validação inicial aceita apenas chave `sb_publishable_...` e host oficial do projeto. A CSP usa a URL do Help Desk; mudar de projeto exige atualizar a allowlist. Não colocar segredos em prefixos públicos, HTML, fixtures reais ou URLs de suporte.

O site e a base de produção são o destino único de implantação e validação. Branches Git organizam o desenvolvimento do código. Nenhum scheduler/worker foi configurado neste incremento.

## Procedimentos de incidente

### Possível acesso indevido

Suspender o principal/conexão afetado, preservar evidências e correlacionar request IDs; não apagar tickets ou logs para “corrigir”. Avaliar quais conta/workspace/recursos foram alcançados. Revisar a origem da autorização e reproduzir com identidades negativas em ambiente controlado. Reabrir somente depois de teste de regressão e avaliação do responsável. Rotacionar o segredo pertinente quando houver suspeita de exposição, sem trocar indiscriminadamente chaves de todos os produtos.

### Falhas de criação ou respostas 503

Verificar o gate de release e configuração, papel de banco, TLS, migrations aplicadas, conexão do pooler e saúde do Auth. Não trocar para service_role nem carregar dados fictícios. Cliente deve reenviar mutações com a mesma chave idempotente quando resultado for incerto; não gerar automaticamente uma chave nova após timeout.

### Outbox acumulado

Na versão 0.1.0 o outbox acumula intenções porque o dispatcher ainda não existe. Isso não constitui envio concluído. Quando o worker for implementado, medir idade da fila, tentativas, leases e disponibilidade dos destinos; reprocessar com ID de evento estável. Não marcar eventos entregues apenas para zerar indicador.

### Rollback

Preferir corrigir em nova migration aditiva quando houver dados. Não fornecer ou executar um script genérico de DROP dos schemas. Retornar frontend/API a versão compatível; se a alteração mudou contratos de dados, usar plano de compatibilidade expand/contract. Depois de dados reais, rollback do código não equivale a rollback do banco. Restaurar somente por procedimento aprovado e previamente ensaiado.

### Recuperação

Definir RPO/RTO e política de retenção antes da produção. Exercitar restauração do PostgreSQL em destino isolado, conferindo FKs, tickets, versões contratuais, mensagens, notas e ledger. Quando Storage for implementado, restaurar objetos separadamente, comparar inventário/hash/metadados e testar autorização. Não declarar backup de banco como cobertura integral de anexos.

## Governança pendente

A região do banco foi verificada como Canadá. Funções, logs, e-mails, scanner, backups e futuras ferramentas de IA precisam de inventário próprio. Aprovam-se finalidade, acesso, subprocessador, região, retenção, exclusão e recuperação para cada categoria de dado. O desejo de reuso entre sistemas não autoriza compartilhamento de tickets entre operações. Retenção eterna discutida em outros produtos não foi automaticamente aplicada a este Help Desk.
