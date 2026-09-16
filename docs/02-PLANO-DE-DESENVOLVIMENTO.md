# Plano de desenvolvimento e critérios de aceite

> **Atualização v0.2.0 — M1 em andamento:** HD-101 tem guards/CI codificados, mas registry/lock/audit pendentes; HD-102 tem quatro migrations e 35 cenários SQL escritos, nenhum executado; HD-103 tem runtime reforçado, sem homologação no destino; HD-104 tem limites/lifecycle codificados e testes locais, sem carga/SQL real; HD-105 tem paginação/estado e HTTP local testados, navegador bloqueado. Ver documentos 04–06 para evidências atuais. A descrição de M0 abaixo permanece como registro da fundação.


**Data:** 15/09/2026 · **Produto:** Help Desk independente · **Base de código:** 0.1.0  
**Regra de acompanhamento:** codificado, testado localmente, homologado com serviços reais e publicado são estados distintos. Não há percentual global de conclusão estimado sem um backlog dimensionado pela equipe.

## 1. Sequência executiva

A prioridade não é ampliar telas antes de provar isolamento e transações. O produto deve progredir da fundação para persistência homologada, identidade/catálogo, operação com entrega confiável, SLA/roteamento, anexos e integrações reais. Base de conhecimento, canais adicionais e IA vêm depois do atendimento humano funcional.

```mermaid
flowchart LR
  M0[0. Fundação local] --> M1[1. Banco e hardening]
  M1 --> M2[2. Identidade e catálogo]
  M2 --> M3[3. Atendimento e entrega confiável]
  M2 --> M4[4. SLA e roteamento]
  M1 --> M5[5. Anexos seguros]
  M3 --> M6[6. Dois conectores reais]
  M4 --> M6
  M5 --> M6
  M6 --> M7[7. Homologação e produção]
  M7 --> M8[8. Conhecimento, canais e IA]
```

São frentes separáveis depois da fundação, mas não independentes de seus contratos. Autorização de anexos depende do ticket; SLA depende de eventos e versões de política; webhooks dependem do outbox e de autorização do destino. Paralelizar não pode criar três definições incompatíveis de account, principal ou contract_version.

## 2. Marcos e entregáveis

| Marco | Entrega verificável | Dependência | Condição de saída |
|---|---|---|---|
| M0 — Fundação | Domínio, casos de uso, API, interface inicial, migrations candidatas, testes e arquitetura | Relatórios e inspeção | Código e evidências locais entregues. Não significa produção. |
| M1 — Persistência e segurança | Migrations executadas em ambiente descartável, RLS, locks, FKs, driver e Functions homologados | M0 | Suíte PostgreSQL real verde, revisão de privilégios e ausência de acesso direto ao core. |
| M2 — Identidade e configuração | Usuários, memberships, contas, catálogo, contrato/cobertura, credenciais e intakes | M1 | Administração auditável, revogação comprovada e contexto de atendimento configurável sem SQL manual rotineiro. |
| M3 — Operação e confiabilidade | Atribuições, participantes, paginação de conversas, dispatcher, ledger e notificações | M2 | Ticket até destinatário externo comprovado inclusive em crash/timeout/retry. |
| M4 — SLA e roteamento | Calendário/política versionados, clocks, regras, simulação e filas | M2/M3 eventos | Tempo de resposta e resolução reproduzíveis; conflito de regra não publica silenciosamente. |
| M5 — Arquivos | Upload em quarentena, inspeção/antimalware, download autorizado, lifecycle e backup | M1/M3 autorização | Arquivo não validado nunca baixável; restauração de objetos ensaiada. |
| M6 — Integrações | Conector GeoLab e conector não laboratorial, sessão incorporada por pessoa | M2–M5 | Dois produtos reais usam a mesma API sem alterar core com colunas de domínio externo. |
| M7 — Produção | Carga, pentest, observabilidade, DR, release e suporte operacional | M1–M6 | Gates aprovados, rollback testado e liberação explícita de ambiente. |
| M8 — Evolução | KB, macros, CSAT, e-mail inbound, outros canais e IA opcional | M7 | Nenhuma dependência desses recursos para abrir ou atender chamado humano. |

O relatório A contém uma estimativa histórica de 110–177 dias-pessoa. Ela não foi convertida em prazo de calendário nem compromisso nesta entrega. Recomenda-se estimar os itens abaixo com a equipe após conhecer regras contratuais, volume, perfis e canais; usar complexidade e risco até lá.

## 3. M0 — O que foi desenvolvido nesta entrega

| Área | Implementação | Evidência/limite |
|---|---|---|
| Autorização de domínio | Workspace, conta, solicitante, gestor da conta, agente, admin e conexão com instância | Testes positivos/negativos locais. |
| Contrato | Vigência, suspensão, ambiguidade, seleção explícita e snapshot | Testes locais; locks reais pendentes. |
| Tickets | Criar, listar por cursor, consultar e transicionar | API testada com adaptador transacional de memória. |
| Conversa | Resposta pública, nota em estrutura própria e timeline projetada | Testes impedem leitura de notas por cliente/integração. |
| Concorrência | Idempotência por principal/operação e versão esperada | Reenvio e concorrência simulada aprovados; PostgreSQL real pendente. |
| Confiabilidade | Ticket, evento e intenção de outbox na unidade de trabalho | Rollback local testado; trigger SQL diferida ainda não executada. |
| Autenticação | Validação humana com Auth, grants vivos e troca M2M por token opaco | Testes de adaptadores usam respostas controladas, não o Supabase remoto. |
| Persistência | Driver pg, contexto transacional, SQL parametrizado e login restrito | Compilação e testes de orquestração SQL; conexão real não homologada. |
| Interface | Lista, contexto, criação, conversa, notas, transições e perfis demonstrativos | Código e sintaxe verificados; navegador bloqueado no ambiente. |
| Calendário | Função pura com jornadas, timezone, feriados e horizonte | Não está conectado a clocks, alertas ou deadlines reais. |
| Plataforma | Netlify adapter, configuração fechada por padrão e OpenAPI | Build estático local; empacotamento Functions e deploy pendentes. |

## 4. M1 — Próxima etapa prioritária, detalhada

### HD-101 — Repositório e dependências reproduzíveis

**Prioridade:** P0 · **Risco:** alto · **Responsável sugerido:** engenharia/plataforma.  
**Arquivos:** `package.json`, `package-lock.json` a gerar, `.github/workflows/ci.yml`, `netlify.toml`.

Inspecionar novamente o repositório antes de importar o pacote, porque o estado remoto pode ter mudado. Se permanecer vazio, revisar o primeiro commit em uma branch de trabalho e definir a política de inicialização da principal; não inventar uma PR contra uma branch principal sem histórico. Instalar as dependências declaradas em ambiente autorizado, conferir versões e alertas, gerar lockfile, revisar a árvore, trocar instalação no CI por `npm ci` e fixar ações por SHA aprovado. Não aceitar “build verde” baseado somente em cópia de HTML.

**Aceite:** instalação limpa reproduzível; testes e typecheck verdes; auditoria de dependências sem pendência alta aceita implicitamente; driver pg incluído no pacote Functions; branch/commit identificados. O lockfile não foi gerado nesta sessão porque não houve acesso utilizável ao registry.

### HD-102 — Exercitar migrations e privilégios em PostgreSQL real

**Prioridade:** P0 · **Risco:** crítico · **Arquivos:** `supabase/migrations/*.sql`, `supabase/tests/rls.test.ts`.

Subir um PostgreSQL 17 local descartável com banco `helpdesk_test`; fornecer URLs de administrador de teste e do login `helpdesk_app`; executar a suíte que aplica as migrations e cria fixtures de dois workspaces/contas. O teste exige opt-in e recusa hosts remotos ou bancos com outro nome. Seu preparo não apaga schemas existentes: exige banco novo.

```bash
ALLOW_DATABASE_TESTS=1 \
HELPDESK_TEST_ADMIN_URL='postgresql://postgres:SENHA_LOCAL@127.0.0.1:5432/helpdesk_test' \
HELPDESK_TEST_APP_URL='postgresql://helpdesk_app:SENHA_LOCAL_APP@127.0.0.1:5432/helpdesk_test' \
npm run test:db
```

**Aceite mínimo:** 15 cenários reais da suíte passam com papel de request efetivo; nenhuma tabela sem ENABLE/FORCE RLS; PUBLIC não executa helpers; contas irmãs e workspaces distintos isolados; notas internas negadas no SQL; credenciais inacessíveis diretamente; rollback/contexto/imutabilidade/conflito/concorrência/revogação comprovados. Depois disso, ampliar cenários negativos de FKs compostas, escrita de mensagem em ticket alheio, grants de escopo e deadlocks. Não tratar os testes de memória como substitutos.

### HD-103 — Homologar no Supabase e no runtime de destino

**Prioridade:** P0 · **Risco:** crítico · **Dependência:** HD-101/102.

Usar projeto/ambiente de homologação aprovado, sem dados reais. Qualquer criação de infraestrutura cobrada precisa de autorização de custo; não criar branches Supabase automaticamente. Conferir schemas expostos, donos de helpers, login restrito, conexão/pooler e TLS com certificado válido. Aplicar migrations somente dentro do fluxo autorizado. Reconsultar Advisors e comprovar o tratamento de `public.rls_auto_enable()` sem alterar arbitrariamente seu corpo.

Executar a API real sob Netlify Functions, autenticar uma pessoa no Supabase, revogar seu vínculo, repetir testes de conta e verificar mudança de acesso. Exercitar token M2M, expiração, rotação e revogação. Medir conexões e latência sob concorrência. O gate `HELPDESK_RELEASE_APPROVED` não deve ser ligado apenas para contornar um 503.

**Aceite:** mesma API comprovada com persistência real e versão identificada; nenhuma service key ou senha de banco no bundle, logs ou repositório; fonte de dados real nunca cai silenciosamente para demo.

### HD-104 — Segurança e limites antes de piloto

**Prioridade:** P0 · **Risco:** crítico.

Implementar rate limiting distribuído por IP/conexão/workspace, inclusive na troca de credenciais; quotas para idempotência e sessões; expiração e limpeza controlada; limites de mensagens e timeline. Definir o intervalo tolerado para requisições já em andamento durante revogação. Criar observabilidade de rejeições sem registrar bearer, URL assinada ou corpo sensível. Revisar exposição de metadados em problemas e serializers.

**Aceite:** teste de abuso e isolamento de vizinho ruidoso; políticas documentadas de 429/Retry-After, retenção de registros técnicos e capacidade. O papel da aplicação continua sem acesso global para tarefas administrativas.

### HD-105 — Homologação visual e de sessão

**Prioridade:** P0 para piloto · **Arquivos:** `web/*`, `tests/browser-smoke.py`.

Executar a demonstração com `npm run demo` em ambiente onde o navegador possa acessá-la; rodar o teste Playwright e capturar desktop/mobile. Validar troca rápida de perfis, limpeza de conteúdo anterior, rascunhos público/interno separados, navegação por teclado, modal, leitor de tela, estados vazios, 401/403/409/412/503, perda de rede e reenvio. Testar um ticket com texto muito longo e caracteres maliciosos. O teste de navegador desta sessão foi bloqueado pela política do ambiente e não possui resultados positivos.

**Aceite:** nenhuma rolagem horizontal nos tamanhos aprovados; formulários utilizáveis; ausência de execução de HTML de usuário; nenhum conteúdo interno visível ao perfil cliente; sessão expirada não produz perda silenciosa de edição.

## 5. M2 — Identidade, configuração e direito ao atendimento

| ID | Entrega | Aceite objetivo |
|---|---|---|
| HD-201 | Bootstrap do primeiro workspace e administrador | Procedimento auditado, sem signup administrativo público ou senha fixa no código. |
| HD-202 | Gestão de membros e acessos | Convite, aceite, reset, expiração e revogação ponta a ponta; papel efetivo por conta, contrato e capacidade. |
| HD-203 | Política administrativa e MFA | Decisão aprovada; fatores e recuperação testados, sem exigir fator inexistente ou bloquear acesso sem caminho de suporte. |
| HD-204 | Catálogo de produtos/instâncias/serviços | CRUD autorizado, nomespaced e auditado; desativação não destrói histórico. |
| HD-205 | Contas e mapeamentos externos | Conexão + referência externa única; cruzamento de contas negado; sem matching automático por nomes parecidos. |
| HD-206 | Contratos/versionamento/coberturas | Rascunho, publicação e nova versão; vigência exclusiva no limite final; cobertura incompatível rejeitada. |
| HD-207 | Simulador de elegibilidade e intakes | Explica candidatos sem dados indevidos; sem cobertura encaminha triagem sem compromisso contratual fictício. |
| HD-208 | Lifecycle de credenciais | Chave exibida uma vez, hash no banco, rotação com janela explícita, expiração e revogação separadas por conexão. |
| HD-209 | Trilha administrativa | Mudança de permissão, contrato, mapeamento e segredo deixa ator, ação, recurso, instante e request ID; sem registrar o segredo. |

Dados de configuração que hoje só existem como fixtures ou via provisionamento não devem ser apresentados como um backoffice já pronto.

## 6. M3 — Operação e processamento confiável

Criar equipes, filas, atribuições e participantes com autorização distinta de roteamento. A paginação de mensagens/histórico foi antecipada no código da v0.2.0 para limitar leituras no M1; ainda falta homologá-la com banco e navegador reais. Acrescentar busca por texto dentro do escopo, filtros combináveis e observações de atendimento. Acesso por participante deve ser explícito, revogável e restrito ao ticket; não pode promover alguém a gestor de conta.

O dispatcher deve selecionar eventos pendentes com lock e lease, gerar entregas por destino e registrar tentativas. Falha de um provedor não deve impedir outras contas de serem atendidas. Usar limites de concorrência por workspace, backoff/jitter, circuit breaker por destino, DLQ e reprocessamento administrativo auditado. O worker terá papel de banco próprio e privilégios mínimos; não usar a chave de serviço do browser ou ampliar o papel HTTP.

**HD-301:** operação e participantes. **HD-302:** paginação/busca. **HD-303:** dispatcher/lease. **HD-304:** ledger/retries/DLQ. **HD-305:** webhooks HMAC, rotação e SSRF. **HD-306:** notificações por e-mail com preferências e deduplicação. **HD-307:** limpeza/retensão de registros técnicos.

**Aceite do primeiro fluxo vertical completo:** sistema consumidor autentica → resolve contexto → cria ticket idempotente → ticket/evento/outbox confirmam juntos → agente responde → destino recebe webhook autenticável → retry duplica tentativa, mas não duplica ticket nem corrompe efeitos lógicos. Esse fluxo completo ainda não foi entregue porque não existe worker de envio nesta versão.

## 7. M4 — SLA e roteamento

**HD-401:** calendários e versões, incluindo fusos, feriados e jornadas fracionadas.  
**HD-402:** políticas de SLA versionadas com first_response, next_response e resolution.  
**HD-403:** clocks e eventos de início/pausa/retomada/conclusão/violação.  
**HD-404:** reconciliação e recomputação explicável sem alterar snapshots antigos.  
**HD-405:** regras de roteamento versionadas, prioridades e simulador.  
**HD-406:** métricas e alertas operacionais.

**Aceite:** casos conhecidos para virada de dia, fim de semana, feriados, segundos e mudança de horário de verão; automação não satisfaz resposta humana indevidamente; reabertura segue política explícita; alterações contratuais não recalculam histórico sem ação auditada; duas regras conflitantes não são escolhidas pela ordem acidental de leitura.

O motor puro atual é referência, não scheduler. A equipe deve avaliar algoritmo por intervalos, persistência de eventos, índices, recuperação de jobs e comportamento sob relógios atrasados. Horário de funcionamento do suporte e metas por prioridade precisam ser aprovados pelo negócio; não se presumem a partir das fixtures demonstrativas.

## 8. M5 — Anexos e recuperação

**HD-501:** política de tamanho/tipo e presign privado. **HD-502:** quarentena, complete e inspeção de bytes. **HD-503:** antimalware, falha fechada e promoção. **HD-504:** autorização de download, TTL curto e visibilidade de nota interna. **HD-505:** limpeza de órfãos, retenção e inventário. **HD-506:** backup e restauração de objetos com manifesto e comparação com metadados.

**Aceite:** arquivo sem inspeção não pode ser distribuído; conhecer o storage key não permite download; MIME/extensão divergentes são tratados; upload repetido não cria vínculos duplicados; perda de permissão impede nova URL; URLs emitidas têm validade curta conhecida; restore de banco sozinho não é reportado como recuperação de anexos.

## 9. M6 — Dois sistemas reais e suporte incorporado

A prova local atual usa contextos de laboratório e escola, apenas fixtures. Ela não substitui os conectores reais.

O conector GeoLab deve validar usuário/laboratório no backend de origem, transformar IDs por mappings autorizados e enviar diagnóstico com allowlist, sem cookies, bearer tokens, senhas ou extração indiscriminada de estado da aplicação. O Help Desk resolve a relação de atendimento: suporte da Consulte ao laboratório não se confunde com suporte do laboratório à construtora.

O segundo conector deve ser semanticamente distinto, preferencialmente sistema escolar ou financeiro, após decisão do usuário. Ambos devem usar os mesmos endpoints e passar os mesmos testes de contrato. Não é permitido criar uma migration `laboratorio_id`, `obra_id` ou `aluno_id` no núcleo para fazer a integração funcionar.

**HD-601:** protocolo de suporte incorporado com token curto por pessoa, audience, bindings, expiração e revogação. **HD-602:** conector GeoLab server-side. **HD-603:** segundo conector. **HD-604:** reconciliação de mappings, idempotência e testes de contrato. **HD-605:** hardening de iframe/postMessage/origins, caso a experiência incorporada use essas tecnologias.

A API atual M2M identifica a conexão, não cada usuário externo. Não ativar um widget usando a mesma sessão para todos os usuários do produto.

## 10. M7/M8 — Release, operação e evolução

A liberação exige evidências arquivadas por commit: suíte local, banco real, API no host real, navegador, segurança, carga, restore e revisão independente. Definir ambientes, responsabilidades de aprovação, RPO/RTO, retenção e regiões. Registrar inventário de subprocessadores e chaves, plano de rollback e runbooks. Não introduzir processos destrutivos de limpeza ou migração sem dry-run e estratégia de recuperação.

Depois da operação humana estável, priorizar respostas salvas/macros, base de conhecimento por produto, CSAT, dashboards, e-mail bidirecional, tickets relacionados/mesclagem e canais adicionais. Entrada por e-mail precisa de threading, proteção contra loop e auto-reply; não é apenas um formulário novo. IA deve ser opcional, autorizada por contexto e auditável. Não decide acesso, cobertura ou mudança irreversível sozinha e sua indisponibilidade não bloqueia suporte humano.

## 11. Matriz de rastreabilidade resumida

| Requisito dos relatórios | Código/evidência atual | Situação |
|---|---|---|
| GEN-01/02, TEN-001 | Domínio genérico; workspace/account; fixtures de dois produtos | Local testado; conectores reais pendentes. |
| TEN-002, SEC-001/003/004 | FKs compostas, schemas, policies e suíte PostgreSQL | Codificado; execução real pendente. |
| IAM-001/002/003 | Auth humano + credenciais/sessões M2M | Adaptadores testados com doubles; homologação real pendente. |
| IAM-004 | `support-sessions` por usuário externo | Não implementado; capability false. |
| CON-001/002/003 | Versionamento, resolução e seleção de cobertura | Local testado; SQL real pendente. |
| CON-004 | Intake sem cobertura | Não implementado; abertura atual retorna 422. |
| TKT-001/002/003 | Idempotência e If-Match | Local testado; concorrência real pendente. |
| TKT-004/005 | Notas separadas e timeline projetada | Local testado; revisão de browser/SQL pendente. |
| SLA-001 a 005 | Snapshot inicial e cálculo de referência | SLA operacional não implementado. |
| ROU-001 a 003 | Regras e filas | Não implementadas. |
| ATT-001 a 005 | Quarentena e arquivos | Não implementados; capability false. |
| REL-001 | Outbox e trigger diferida | Caso de uso local testado; migration não aplicada. |
| REL-002 a 005 | Retry, ledger, dead letter e worker | Não implementados. |
| API-001/002/003 | OpenAPI, problemas seguros, cursor de tickets | Estrutura verificada; conformance completa e demais coleções pendentes. |
| API-004 | Limite distribuído e noisy neighbor | Não implementado; release bloqueado. |
| API-005/OPS-001/002 | Request ID, eventos e logs mínimos sem corpo | Instrumentação completa/alertas pendentes. |
| OPS-003/004/005 | Restore e runbooks | Procedimentos definidos; ensaios não realizados. |

**Nenhuma linha “codificado” autoriza publicação automática.** A próxima ação recomendada é HD-101/102: dependências reproduzíveis e execução da suíte real PostgreSQL, antes de ampliar funcionalidades.
