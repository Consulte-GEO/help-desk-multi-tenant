> **HD-P06 — 08/10/2026:** recebimento compatível de link integrado e publicado no PR20; API/interface0.26.0/schema0.19.0. Fragmento hash privado, URL limpa e validação só por confirmação, sem adoção de sessão. Template preparado, não aplicado. [Entrega e limites](docs/131-HD-P06-RECEBER-LINK-DE-RECUPERACAO.md). CI1660/229/121 aprovado e revisão limpa; merge/publicação concluídos no PR20, com barreiras verificadas. Template não aplicado; atendimento fechado e ativação/aceite reais pendentes.

> **HD-P06 — 08/10/2026:** solicitação explícita de link integrada/publicada pelo PR19; API/interface0.25.0/schema0.19.0. Pedido email-only sem sessão, retorno condicional e cancelamento sem reenvio/logout fictício; scopes e configuração preservados. [Entrega e limites](docs/130-HD-P06-SOLICITAR-LINK-DE-RECUPERACAO.md). CI1654/229/118 aprovado, navegação corrigida. Merge5c45db7 e produção6ac7cbb8 verificados; atendimento fechado e entrega/SMTP/CAPTCHA/callback/PKCE reais pendentes.

> **HD-P06 — 08/10/2026:** conclusão de recuperação por link direto integrada/publicada pelo PR18; API/interface0.24.0/schema0.19.0. Contexto privado só de senha, MFA preservado, sem workspace/scopes; nenhum e-mail/callback/PKCE nesta fatia. [Entrega e limites](docs/129-HD-P06-CONCLUIR-RECUPERACAO-POR-LINK.md). CI1644/229/115 aprovado; Important corrigido e minor de texto registrado. Merged9932d4 e produção6ac77fa0 verificados; atendimento fechado, envio/PKCE/callback/recuperação real pendentes.

> **HD-P06 — 07/10/2026:** outro TOTP da própria conta integrado/publicado pelo PR17; API/interface0.23.0/schema0.19.0. Exige catálogo vivo verificado/AAL2, retoma pendente ou cria com nome distinto; preserva fatores confirmados e não amplia scopes. [Entrega e limites](docs/128-HD-P06-OUTRO-AUTENTICADOR-TOTP.md). CI1629/229/112 aprovado e revisão sem Critical/Important; minor de texto registrado. Mergedf3d2b9 e produção6ac6f2d7 verificados. Atendimento fechado; recuperação/remoção/QR/admin MFA e aceite real pendentes.

> **HD-P06 — 07/10/2026:** consulta da segurança da própria conta integrada/publicada pelo PR16; API/interface0.22.1/schema0.19.0. Catálogo vivo limitado, fatores confirmados/pendentes e AAL consultivo; dados privados descartados e resposta tardia isolada. Nenhuma gestão/remoção de fatores ou ampliação de scopes. [Entrega e limites](docs/127-HD-P06-CONSULTA-DA-SEGURANCA.md). Revisão corrigida com10 testes; CI1619/229/109 aprovado. Merge4c663a2 e produção6ac6b8ee verificados. Atendimento fechado; gestão de fatores/recovery/admin obrigatório e aceite real pendentes.

> **HD-P06 — 07/10/2026:** primeiro TOTP opcional da própria conta integrado/publicado pelo PR15; API0.22.0/schema0.19.0. Chave manual, catálogo vivo e confirmação, pendente retomado sem criar outro, sem remoção/reset de fatores. Segredo retirado do DOM ao encerrar e nova entrada após confirmação. [Entrega e limites](docs/126-HD-P06-PRIMEIRO-AUTENTICADOR-TOTP.md).9 novos/27 focais/106 interface aprovados; revisão sem achados. Atendimento fechado; fatores adicionais/recovery/QR/admin obrigatório e aceite real pendentes. CI1609/229/106 aprovado; merge912bea2 e produção6ac6ad5e verificados.

> **HD-P06 — 07/10/2026:** login TOTP existente e guard MFA integrados/publicados pelo PR14; API0.21.0/schema0.19.0. Auth valida bearer exato antes de exigir AAL2 para fatores verificados e antes dos vínculos; grants/scopes vivos preservados. Login espera código antes de workspace, cleanup privado e resposta antiga protegidos. [Entrega e limites](docs/125-HD-P06-LOGIN-TOTP-E-VALIDACAO-DE-MFA.md).73 focais/103 interface aprovados; enrollment/recovery/MFA administrativo obrigatório e aceite real pendentes. Atendimento fechado; CI1600/229/103 aprovado; merge24559ce e produção6ac6991e verificados.

> **HD-P06 — 07/10/2026:** código adicional para troca de senha integrado/publicado pelo PR13; API0.20.4/schema0.19.0. Solicitação explícita ao próprio canal cadastrado e nonce opcional, sem reenvio automático ou configuração alterada. Corrigida corrida de despacho concorrente com código/senha;67 focais e99 interface aprovados. [Entrega e limites](docs/124-HD-P06-CODIGO-PARA-TROCA-DE-SENHA.md). Atendimento fechado; SMTP/MFA/recuperação e M1 operacional pendentes. CI1565/229/99 aprovado; merge1c04c76 e produção6ac68492 verificados.

> **HD-P06 — 07/10/2026:** troca da própria senha integrada/publicada pelo PR12; API0.20.3/schema0.19.0. Payload Auth restrito, campos limpos no envio, requisição única e nova entrada após resultado; respeita recusas MFA/autenticação recente sem alterar configuração. [Entrega e limites](docs/123-HD-P06-TROCA-DE-SENHA-AUTENTICADA.md). Atendimento fechado; senha/MFA/SMTP reais, recuperação completa e M1 operacional pendentes. CI1554/229/96 aprovado; merge33c2f86 e produção6ac67460 verificados.

> **HD-P06 — 07/10/2026:** encerramento global das próprias sessões integrado/publicado pelo PR11; API0.20.2/schema0.19.0. Confirmação explícita, limpeza local imediata, novo login bloqueado enquanto o pedido aguarda resultado; logout local continua padrão. [Entrega e limites](docs/122-HD-P06-ENCERRAMENTO-GLOBAL-DE-SESSOES.md). Atendimento fechado; aceite Auth entre dispositivos, MFA/recuperação/administração e M1 operacional permanecem pendentes. CI1544/229/92 aprovado; merge e6ed434 e produção6ac66dae verificados.

> **Estado 07/10/2026 — PR10:** troca segura de workspace publicada com nova autenticação e limpeza do contexto anterior. API0.20.1/schema0.19.0; CI1536/229/89 aprovado. Sem mudanças no banco ou escopos; atendimento bloqueado e M1 operacional aberto. [Evidência e limites](docs/121-HD-P05-TROCA-SEGURA-DE-WORKSPACE.md). Este checkpoint prevalece sobre os estados históricos abaixo.

> **Estado 07/10/2026:** PR9 integrado/publicado; API0.20.0, schema0.19.0,12 migrations/25 tabelas/19 operações, CI1536/229/85 aprovado. Descoberta de workspace no login com UUID opcional; vínculos/scopes preservados. Atendimento fechado e M1 operacional aberto. [Evidência e limites](docs/120-HD-P05-DESCOBERTA-DE-WORKSPACES.md); este checkpoint prevalece sobre os estados históricos abaixo.

> **Continuidade HD-P03 — produção:** clientes read/Auth/write adaptados a production, três exemplos de site separado removidos e 140 testes focais aprovados. CI Linux run37560232763 aprovado: 1.450 aplicação, 215 PostgreSQL e 79 interface. PR4 integrado em0789dc3 e código publicado em produção (deploy6ac5aaaf); aceite operacional pendente. [Política e evidência](docs/116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **HD-P03 — 06/10/2026:** homologação hospedada na mesma base/site HelpDesk, conforme decisão do usuário. CI Linux 1.447/215/79 aprovado; PR4 pronto para revisão. Aceite Auth/Function/base atual permanece pendente. Leia [docs/116-HD-P03-VALIDACAO-EM-PRODUCAO.md](docs/116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **Decisão do usuário — 06/10/2026:** O único ambiente do Help Desk é produção: site helpdesk-consultegeo e projeto Supabase HelpDesk xaelbntjnvztznnpcvtm. Desenvolvimento, implantação e validação hospedada usam esse destino. Não solicitar ambiente ou credenciais de teste ao usuário.

> **HD-P02 — 06/10/2026:** recuperação da abertura corrigida;14 testes focais e79 verificações de interface aprovados. Windows1447/1424/23 (mesmas falhas anteriores); CI novo/aceite hosted pendentes. Leia [docs/115-HD-P02-RECUPERACAO-DA-ABERTURA.md](docs/115-HD-P02-RECUPERACAO-DA-ABERTURA.md). M1 operacional aberto.

> **HD-P01 — 06/10/2026:** PR3/R24 integrado em `b4dd000`; CI R24 1436/215/71 aprovado, gate publicado fechado e M1 operacional aberto. Estado corrente e mapa das onze migrations em [docs/114-HD-P01-ESTADO-POS-R24.md](docs/114-HD-P01-ESTADO-POS-R24.md). Números e destinos anteriores abaixo são históricos.

> **M1-R24 — 05/10/2026:** base canônica R23 `072287f`, com R20–R22 já integrados. Estado, revisão e evidências desta rodada em [docs/113-M1-R24-REVISAO-E-ESTADO.md](docs/113-M1-R24-REVISAO-E-ESTADO.md). M1 operacional aberto; M2 não iniciado. Os estados antigos abaixo são históricos.

# Estado de continuidade — M1-R24 / 05-10-2026

Base GitHub confirmada: `072287f934b5f7620d14531181a7cb4f01fadc6b`, após merge R23 `129a434`. R20–R22 integrados; não reaplicar seus patches. Fingerprint executável preservado: `659e9ad6d69d822888486a59b2c9c6bf5d39c7a3ec1391ee29fd048c0e9a6a82`.

Estado atual em [113-M1-R24-REVISAO-E-ESTADO.md](docs/113-M1-R24-REVISAO-E-ESTADO.md); backlog em [05-HANDOFF-REVISAO.md](docs/05-HANDOFF-REVISAO.md). A autorização direta de 05/10/2026 permite revisão, correções necessárias, commit, merge e publicação técnica sem revisão do Claude. Não representa aceite operacional nem identifica novos recursos cobrados ou fixtures remotas.

Instalação e auditoria locais passaram; 1.413/1.436 Node passaram no Windows, com 23 falhas preservadas. CI Linux R23: 1.436 Node, 215 SQL e 71 HTTP/browser. Site atual `helpdesk-consultegeo` (ID `9781cd85-7dc1-4ef5-868b-947e389a9d4d`); Supabase HelpDesk com onze migrations e 25 tabelas privadas com RLS habilitada/forçada, por introspecção somente leitura. Homologação hospedada, capacidade, restauração e aceite continuam pendentes.

## Leitura do histórico

O preâmbulo anterior foi preservado em [histórico R23](docs/history/r23-project-introductions.md). O corpo mestre abaixo permanece literalmente preservado como decisões e histórico. Seus números, destinos e pendências antigos devem ser confrontados com o estado R24; em particular, não usar a antiga ausência de lock/migrations/tabelas como estado atual.

---

# PROJETO MESTRE — HELP DESK GENÉRICO, MULTIPRODUTO E MULTICONTRATO

> Documento de contexto, continuidade e instruções para uso em **Projetos do GPT** e no **Codex**.
>
> **Projeto:** Help Desk Multi-Tenant / Multi-Produto / Multi-Contrato  
> **Empresa:** Consulte GEO / Concresoft  
> **Última base local consolidada conhecida:** v0.19.0  
> **Data desta consolidação:** 2026-09-28  
> **Idioma de produto e documentação:** Português do Brasil  
> **Status:** desenvolvimento em andamento; **não considerar pronto para produção**.

---

# 1. Como usar este documento

Este arquivo deve ser utilizado como **fonte mestre de contexto do projeto**.

## 1.1 No Projeto do GPT

Criar um projeto chamado, por exemplo:

**Help Desk — Consulte GEO / Concresoft**

Adicionar este arquivo às fontes/instruções do projeto junto com, sempre que disponível:

- ZIP cumulativo mais recente do Help Desk;
- bundle Git mais recente;
- documento de handoff da versão atual;
- documento de estado e evidências;
- relatórios de revisão;
- especificação OpenAPI;
- migrations;
- documentação do banco e arquitetura.

O GPT deve usar este documento para:

- entender a arquitetura e as decisões já tomadas;
- não reconstruir funcionalidades que já existem;
- distinguir implementação local de homologação real;
- revisar especificações;
- criar planos de desenvolvimento;
- revisar entregas do Codex;
- gerar handoffs, tarefas, documentação e critérios de aceite;
- preservar a genericidade do Help Desk.

## 1.2 No Codex

Salvar este arquivo no workspace/repositório, preferencialmente como:

```text
PROJECT_HELP_DESK.md
```

ou incorporar suas regras estáveis ao `AGENTS.md`.

Antes de alterar código, o Codex deve ler:

1. este documento;
2. `README.md`;
3. `AGENTS.md`;
4. handoff da versão mais recente;
5. estado/evidências da versão mais recente;
6. migrations e manifesto;
7. plano vigente;
8. mudanças concorrentes do repositório.

Nunca pressupor que um ZIP antigo, uma conversa anterior ou um resumo histórico representa o `HEAD` atual.

---

# 2. Objetivo do produto

Construir um **Help Desk independente dos sistemas clientes**, capaz de atender vários produtos e empresas sem incorporar particularidades de um sistema específico ao núcleo.

O Help Desk não deve ser um módulo interno do GeoLab. Deve ser um **produto central de suporte**, com:

- banco próprio;
- autenticação própria para pessoas;
- credenciais próprias para integrações;
- API própria;
- contratos versionados;
- atendimento;
- filas;
- SLA;
- anexos;
- notificações;
- integrações;
- auditoria;
- observabilidade;
- recuperação;
- interfaces para cliente, atendente e administração.

Produtos como GeoLab, Financeiro, sistema escolar e futuros sistemas devem integrar-se ao mesmo núcleo por conectores/adaptadores.

---

# 3. Ambientes e destinos conhecidos

## GitHub

```text
Consulte-GEO/help-desk-multi-tenant
```

Estado histórico observado: o repositório remoto não representava ainda a fonte cumulativa local. Sempre reinspecionar antes de integrar.

## Supabase

```text
Projeto: HelpDesk
Project Ref: xaelbntjnvztznnpcvtm
Região histórica: ca-central-1
```

Estado histórico observado:

- sem tabelas do Help Desk aplicadas;
- sem ledger de migrations;
- alerta de segurança em `public.rls_auto_enable()`.

Aprovar formalmente a região/residência antes de dados reais.

## Netlify

```text
Projeto: help-desk-multi-tenant
Site ID histórico: ee32e955-42e5-4417-bf4f-39cbef2366cc
```

O deploy remoto historicamente observado não correspondia ao código acumulado mais recente.

**Nunca confundir frontend estático publicado com backend homologado.**

---

# 4. Arquitetura obrigatória

Princípio central:

```text
Sistemas externos conhecem a API.
A API conhece o domínio do Help Desk.
Conectores conhecem as particularidades dos sistemas externos.
```

Usar uma **Anti-Corruption Layer** para traduzir conceitos externos ao modelo canônico.

Exemplo:

```text
GeoLab.laboratorio_id
    ↓ connector
HelpDesk.account_id
```

O núcleo **não pode ganhar** colunas específicas como `laboratorio_id`, `obra_id`, `concretagem_id`, `escola_id` ou `financeiro_empresa_id` apenas porque um consumidor usa esses conceitos.

Arquitetura preferida:

```text
Monólito modular + processos/worker assíncronos
```

Não iniciar com microsserviços sem evidência de necessidade.

---

# 5. Modelo de multitenancy

A fronteira não é apenas `tenant_id`.

```text
Workspace
 ├── membros
 ├── produtos
 ├── contas
 ├── contratos
 ├── equipes
 └── integrações

Produto
 └── Instâncias

Conta
 ├── memberships
 ├── referências externas
 └── contratos/coberturas

Contrato
 └── versão publicada
      ├── coberturas
      ├── SLA
      ├── calendário
      └── regras de roteamento

Ticket
 └── snapshot das regras aplicadas
```

Regras obrigatórias:

- `workspace_id` explícito nos recursos do workspace;
- `account_id` explícito nos recursos tenant-scoped;
- FKs compostas quando apropriado;
- autorização no backend como primeira barreira;
- RLS + GRANTs como segunda barreira;
- ID recebido do cliente é seletor, nunca autorização;
- conhecer UUID não concede acesso;
- fila não concede acesso;
- responsabilidade/atribuição não concede acesso.

---

# 6. Autenticação e autorização

## Pessoas

Usar Supabase Auth para identidade humana.

A autorização efetiva deve considerar:

```text
papel
+ workspace
+ conta
+ contrato/recurso
+ capacidades
+ estado/configuração
= autorização
```

Não confiar exclusivamente em role armazenada no JWT.

Auth user ID e principal interno podem ser diferentes.

## Integrações M2M

Não reutilizar login humano e nunca entregar `service_role` para produto cliente.

Cada conexão deve possuir:

- `key_id`;
- segredo de alta entropia;
- somente hash persistido;
- escopos;
- validade;
- rotação;
- revogação;
- último uso;
- auditoria.

O browser de um produto consumidor nunca deve receber o segredo M2M.

---

# 7. Contratos e cobertura

Contrato de suporte é entidade de primeira classe.

Uma conta pode ter vários contratos. Um contrato pode possuir várias versões. Uma versão publicada deve ser historicamente imutável.

Cobertura deve relacionar pelo menos:

```text
workspace
account
product
service
contract_version
vigência
```

Resultados de resolução:

```text
0 cobertura  → no_coverage / intake controlado
1 cobertura  → resolved
N coberturas → ambiguous / seleção explícita
```

Nunca selecionar silenciosamente o primeiro contrato.

Ao criar o ticket, revalidar a cobertura dentro da operação.

O ticket deve preservar o `contract_version` aplicado na abertura. Uma alteração futura não reescreve o passado do chamado.

---

# 8. Ticket e conversa

Mensagens públicas e notas internas devem permanecer estruturalmente separadas:

```text
ticket_messages
internal_notes
```

Notas internas nunca podem aparecer em:

- API do cliente;
- portal;
- busca do cliente;
- exportação;
- webhook externo;
- notificação pública.

Estados e alterações relevantes precisam de histórico auditável.

---

# 9. Idempotência e concorrência

Operações mutáveis importantes usam `Idempotency-Key`.

Persistir:

```text
principal
operation
key
request_hash
status
response
resource_id
created_at
expires_at
```

Regra:

```text
mesma key + mesmo payload
→ devolver resposta original

mesma key + payload diferente
→ conflito

resultado incerto
→ não inventar nova chave
→ não repetir automaticamente a escrita
```

Updates concorrentes devem usar versão/ETag/`If-Match`.

Nunca transformar falha de confirmação em sucesso presumido.

---

# 10. Outbox e efeitos externos

A operação de domínio e a intenção de notificação devem ser atômicas.

```text
BEGIN
→ grava ticket/mensagem/mudança
→ grava ticket_event
→ grava outbox_event
→ COMMIT

outbox
→ dispatcher
→ queue
→ worker
→ webhook/e-mail
→ delivery ledger
```

**Outbox não significa notificação enviada.**

Não prometer exactly-once para integrações externas. Trabalhar com:

```text
at-least-once
+ idempotência
+ delivery ledger
+ retry
+ dead letter
```

---

# 11. Anexos

Fluxo esperado:

```text
pedido de upload
→ registro pending
→ signed upload URL curta
→ bucket privado de quarentena
→ complete
→ validação hash/tamanho/MIME
→ malware scan
→ clean | rejected | quarantined
→ vínculo com ticket
→ download autorizado por recurso
```

Nunca usar bucket público para conteúdo de suporte.

Conhecer storage key não autoriza download.

Backup do banco e backup dos objetos Storage são responsabilidades distintas.

---

# 12. SLA

SLA ainda é um dos grandes módulos pendentes.

Não armazenar apenas `due_at`.

Relógios independentes:

```text
first_response
next_response
resolution
```

Cada política deve ser versionada.

Calendários devem considerar timezone, dias úteis, horários, feriados, exceções, vigência e versão.

Eventos dos relógios:

```text
start
pause
resume
satisfied
breached
cancelled
```

`waiting_customer` só pausa relógio se a política determinar.

Resposta automática não satisfaz SLA de resposta humana por padrão.

Actor types previstos:

```text
HUMAN_AGENT
CUSTOMER
AUTOMATION
INTEGRATION
SYSTEM
```

---

# 13. Roteamento

Roteamento é separado de autorização.

Criar:

- equipes;
- filas;
- rulesets;
- versões;
- prioridades explícitas;
- condições;
- destinos;
- fallback;
- simulador;
- detecção de conflitos antes da publicação.

Exemplo:

```text
conta + produto + serviço + severidade
→ contrato
→ SLA
→ fila
→ matched rules
```

---

# 14. Estado conhecido — v0.19.0

```text
API/interface: 0.19.0
Schema esperado: 0.18.0
Migrations candidatas: 11
Tabelas candidatas: 25
Operações HTTP: 18
Caminhos HTTP: 14
Branch local: work/helpdesk-v0.19.0
Commit: 94d827654d0ca19144b857e014acef1494f924b3
```

Evidência local conhecida:

```text
1.040 testes Node aprovados
35 checks HTTP locais aprovados
201 testes PostgreSQL escritos
36 checks browser escritos
```

Os **201 testes PostgreSQL não estavam homologados em servidor real naquela entrega**.

Os checks browser estavam bloqueados pela política do ambiente.

A instalação padrão ainda estava bloqueada por indisponibilidade do registry.

**M1 permanece aberto.**

---

# 15. O que já foi desenvolvido

Não reimplementar sem evidência de regressão.

## Fundação

- monólito modular TypeScript;
- contrato HTTP;
- OpenAPI estrutural;
- persistência em memória;
- adaptador PostgreSQL;
- migrations;
- testes;
- demo/interface estática;
- logs seguros;
- health/readiness candidates.

## Segurança e multitenancy

- workspace/account;
- principal humano;
- principal M2M;
- autorização contextual;
- RLS candidata;
- IDs estritos;
- proteção cross-account;
- validação de respostas do adaptador;
- proteção contra conteúdo inconsistente.

## Sessão humana

- login;
- token em memória;
- refresh;
- single-flight de refresh;
- logout;
- proteção contra respostas atrasadas;
- limpeza ao trocar identidade;
- falha temporária sem replay automático da mutação.

## Tickets

- criação;
- consulta;
- listagem;
- paginação por cursor;
- busca;
- filtros;
- estado;
- prioridade;
- atribuição a si;
- liberação;
- histórico;
- concorrência otimista;
- ações disponíveis calculadas pelo servidor.

## Conversas

- mensagens públicas;
- notas internas separadas;
- paginação;
- autorização;
- falha de notas isolada da conversa pública;
- histórico de eventos;
- não exposição de nota ao cliente.

## Contratos

- resolução de suporte;
- zero/uma/múltiplas coberturas;
- snapshot;
- vigência;
- precisão temporal;
- validação integral do retorno de coberturas;
- replay preservando resposta histórica.

## Idempotência

- cache/result record;
- request hash;
- replay;
- conflito;
- validação estrutural do resultado;
- rejeição de cache inconsistente;
- preservação de resultado histórico.

## Banco e transações

- confirmação de resultados de escrita;
- rollback;
- resultado de COMMIT incerto;
- write-effects candidates;
- evento obrigatório;
- outbox obrigatória quando aplicável;
- permissões humanas versionadas candidate;
- replay de nota compatível com `notes:write`.

## Interface

- login;
- seleção/contexto;
- listagem;
- busca/filtros;
- abertura;
- detalhe;
- mensagens;
- notas;
- prioridade;
- atribuição;
- timeline;
- sessão expirada;
- estados de erro.

---

# 16. O que NÃO está concluído

## M1 — Fundação/homologação

Ainda falta:

- `package-lock` real;
- `npm ci` reproduzível;
- `npm audit`;
- PostgreSQL 17 real;
- execução dos 201 testes SQL;
- fresh install;
- upgrade completo;
- RLS/grants reais;
- pooler;
- TLS;
- Netlify Functions com dependências reais;
- Auth real;
- M2M real;
- navegador;
- mobile;
- acessibilidade;
- carga;
- restore;
- revisão independente;
- pentest;
- aprovação de residência;
- RPO/RTO;
- release gate real.

## M2 — Administração

Não existe backoffice completo para:

- workspaces;
- usuários;
- memberships;
- capacidades;
- contas;
- produtos;
- instâncias;
- serviços;
- contratos;
- versões;
- coberturas;
- equipes;
- filas;
- integrações M2M;
- credenciais;
- auditoria administrativa.

## Operação

Ainda faltam:

- atribuir a outro agente;
- transferência entre equipes;
- participantes;
- relações entre tickets;
- merge;
- request types;
- categorias;
- severidade/impacto/urgência;
- macros/respostas salvas.

## SLA e Routing

Ainda não operacionais.

## Worker/dispatcher

Ainda não operacional.

## Webhooks/e-mail

Ainda não operacionais.

## Anexos

Ainda não implementados como fluxo seguro completo.

## Conector GeoLab

Ainda não existe integração real de ponta a ponta.

## Segundo produto

Ainda não foi feita a prova de genericidade com produto semanticamente diferente.

## DR e observabilidade

Ainda não homologados para produção.

---

# 17. Roadmap obrigatório

## Fase 1 — Encerrar M1

```text
dependências
→ PostgreSQL
→ migrations/upgrades
→ RLS/grants
→ Auth/M2M
→ Functions/runtime
→ navegador
→ carga
→ backup/restore
→ revisão
```

Não usar novas features como substituto da homologação.

## Fase 2 — M2 Administração

1. usuários/memberships;
2. capacidades;
3. contas;
4. produtos/instâncias;
5. serviços;
6. contratos;
7. versões/coberturas;
8. equipes/filas;
9. conexões M2M;
10. credenciais;
11. auditoria.

## Fase 3 — Operação de atendimento

- atribuição avançada;
- participantes;
- filas;
- equipes;
- links/merge;
- request types;
- macros.

## Fase 4 — SLA e roteamento

- calendários;
- policy versions;
- clocks;
- routing rulesets;
- simulador;
- alertas.

## Fase 5 — Dispatcher e notificações

- outbox consumer;
- PGMQ/Supabase Queues;
- worker;
- retry;
- jitter;
- dead-letter;
- delivery ledger;
- e-mail;
- webhooks;
- assinatura HMAC;
- SSRF protection.

## Fase 6 — Anexos

- quarantine;
- scan;
- promotion;
- signed download;
- retenção;
- backup/restore.

## Fase 7 — Integrações

Primeiro GeoLab. Depois obrigatoriamente Financeiro ou outro sistema semanticamente diferente.

## Fase 8 — Produção

- segurança transversal;
- capacidade;
- observabilidade;
- restore;
- runbooks;
- homologação;
- release;
- smoke;
- rollback.

---

# 18. Evoluções posteriores

## P1

- e-mail inbound;
- base de conhecimento;
- macros;
- CSAT;
- automações;
- dashboards;
- full-text search;
- merge avançado;
- parent/child;
- calendário;
- exportações controladas.

## P2 / IA

- classificação automática;
- resumo;
- RAG;
- sugestão de resposta;
- detecção de duplicados;
- sentimento;
- WhatsApp;
- voz;
- automação preditiva.

IA nunca decide autorização, contrato, SLA oficial, permissão ou alteração irreversível sozinha.

---

# 19. Regras de desenvolvimento para GPT e Codex

## Antes de implementar

Sempre:

1. recuperar a fonte mais recente;
2. confirmar branch/commit/base;
3. ler handoff;
4. ler estado/evidências;
5. verificar migrations;
6. verificar mudanças concorrentes;
7. reproduzir baseline;
8. revisar arquitetura afetada.

Nunca começar de um ZIP antigo se existe uma base mais recente.

## TDD

Para feature/bugfix:

```text
teste que falha
→ confirmar falha correta
→ implementação mínima
→ teste passa
→ regressões
→ revisão
```

## Banco

Migrations anteriores são imutáveis.

Mudança estrutural nova = nova migration.

Não usar `db reset`, `migration repair`, drops indiscriminados ou limpeza de dados reais para fazer teste passar.

## Erro seguro

Nunca retornar stack trace, SQL, token, segredo, payload sensível ou policy interna.

## Timeouts e retries

Nunca aumentar timeout apenas para fazer teste passar.

Nunca repetir mutação automaticamente após resultado incerto.

## Estados de evidência

Sempre diferenciar:

```text
IMPLEMENTADO
TESTADO_LOCALMENTE
SQL_ESCRITO
SQL_EXECUTADO
BROWSER_EXECUTADO
DEPLOYADO
HOMOLOGADO
OPERACIONAL
```

Não resumir tudo como “pronto”.

---

# 20. Operações externas

Por padrão, preparar e testar localmente.

**Não executar sem autorização explícita atual:**

- push;
- merge;
- PR quando a tarefa não autorizou;
- deploy;
- migration remota;
- alteração de dados;
- alteração de usuário;
- MFA;
- segredo;
- bucket;
- Auth config;
- domínio;
- recurso pago;
- exclusão.

Autorização histórica em outro chat não substitui instrução atual.

---

# 21. Critérios mínimos de revisão

Toda entrega deve informar:

```text
base
branch
commit
arquivos alterados
migrations
contrato API
testes existentes
testes novos
testes aprovados
testes não executados
browser
PostgreSQL
dependências
segurança
efeitos externos
limitações
próximo passo
```

Não esconder tentativas que falharam.

---

# 22. Estrutura esperada de entrega

```text
HelpDesk_vX.Y.Z_<tema>.zip
HelpDesk_vX.Y.Z_<tema>.md
HelpDesk_vX.Y.Z_Estado_e_Evidencias.md
HelpDesk_vX.Y.Z_Handoff.md
HelpDesk_vX.Y.Z_git.bundle
```

O ZIP deve ser cumulativo quando solicitado.

---

# 23. Gate do primeiro release P0

O Help Desk somente pode ser considerado candidato real a produção quando provar de ponta a ponta:

```text
Sistema A
→ autentica
→ resolve conta
→ resolve contrato
→ abre ticket idempotente
→ ticket/evento/outbox são atômicos
→ SLA é instanciado
→ fila é definida
→ atendente responde
→ cliente responde
→ anexo é validado
→ worker entrega evento/notificação
→ retry não duplica
→ revogação funciona
→ isolamento A/B funciona
→ DB restaura
→ Storage restaura
```

Depois repetir o mesmo modelo com um **Sistema B semanticamente diferente**, sem alterar o core por particularidades desse sistema.

---

# 24. Cenários bloqueadores de produção

No mínimo:

1. usuário da conta A não lê ticket da conta B;
2. mesmo teste para mensagem;
3. mesmo teste para nota;
4. mesmo teste para anexo;
5. mesmo teste para busca;
6. mesmo teste para exportação;
7. fila sem acesso à conta não concede ticket;
8. contrato A + conta B é recusado;
9. mesma Idempotency-Key concorrente cria um único recurso;
10. mesma key + payload diferente conflita;
11. resposta pública nunca inclui nota;
12. automação não satisfaz SLA humano por padrão;
13. SLA atravessa horário/feriado corretamente;
14. mudança de contrato não altera SLA histórico;
15. rollback do ticket não deixa outbox órfã;
16. crash do worker não corrompe delivery;
17. webhook duplicado pode ser deduplicado;
18. endpoint webhook não permite SSRF;
19. segredo antigo deixa de ser válido conforme política;
20. malware não se torna disponível;
21. signed URL expirada não funciona;
22. acesso revogado não gera nova signed URL;
23. logs não contêm tokens;
24. DB restore funciona;
25. Storage restore funciona;
26. segundo produto integra sem mudança estrutural no core.

---

# 25. Decisões ainda necessárias

Antes de produção, fechar:

- residência dos dados;
- RPO;
- RTO;
- retenção de tickets;
- retenção de anexos;
- limite máximo de arquivo;
- política antimalware;
- MFA administrativo;
- prazo de revogação de sessão;
- rate limits;
- calendários de suporte;
- SLAs;
- filas/equipes;
- escalonamento;
- política de reabertura;
- política de “obrigado” após resolução;
- destinatários de notificações;
- canais habilitados;
- retenção de logs;
- segundo produto da prova de genericidade.

---

# 26. Prompt inicial recomendado para o GPT

```text
Você é responsável pela arquitetura, especificação, revisão e continuidade do
Help Desk independente da Consulte GEO/Concresoft.

Leia PROJECT_HELP_DESK.md e os arquivos mais recentes do projeto antes de
responder.

Sua prioridade é preservar as decisões arquiteturais, evitar regressões,
distinguir implementação de homologação e produzir requisitos e tarefas
executáveis pelo Codex.

Não assuma que um recurso está pronto apenas porque existe código ou teste
local. Sempre diferencie: implementado, testado localmente, testado em
PostgreSQL real, testado em navegador, deployado, homologado e operacional.

Quando eu pedir continuidade:
1. identifique a base mais recente;
2. revise o estado atual;
3. determine a próxima prioridade do roadmap;
4. produza uma especificação objetiva;
5. após implementação, revise evidências e riscos;
6. atualize handoff e backlog.

Preserve o Help Desk como produto genérico multiproduto e multicontrato.
Nunca introduza campos específicos de GeoLab/Financeiro no núcleo.
```

---

# 27. Prompt inicial recomendado para o Codex

```text
Leia integralmente PROJECT_HELP_DESK.md, README.md, AGENTS.md e o handoff da
versão mais recente antes de editar qualquer arquivo.

Sua tarefa é continuar o desenvolvimento do Help Desk seguindo o roadmap
existente, sem reconstruir funcionalidades já implementadas e sem confundir
testes locais com homologação.

Antes de alterar código:
- confirme branch, commit e estado do repositório;
- identifique o último pacote/handoff válido;
- execute o baseline disponível;
- verifique migrations e mudanças concorrentes.

Use TDD para toda mudança funcional:
teste falhando → confirmar causa → implementação → regressão.

Migrations históricas são imutáveis.
Novas mudanças de schema entram em nova migration.

Não execute push, merge, deploy, migration remota, alterações de usuário,
MFA, secrets, buckets ou dados externos sem autorização explícita da tarefa.

A prioridade atual é fechar M1:
dependências reproduzíveis → PostgreSQL 17 e upgrade → RLS/grants →
Auth/M2M/runtime → navegador → carga → restore/revisão.

Depois iniciar M2 administrativo.

Ao final de cada rodada:
- execute verificações possíveis;
- documente bloqueios reais;
- não transforme testes escritos em testes aprovados;
- gere estado/evidências;
- gere handoff;
- mantenha a compatibilidade documentada;
- informe base, branch e commit.
```

---

# 28. Regra de ouro

A prioridade não é acumular versões.

A prioridade é evoluir de:

```text
código local confiável
```

para:

```text
produto operacional verificável
```

sem quebrar:

```text
isolamento
autorização
contratos
histórico
idempotência
segurança
genericidade
```

---

# 29. Próxima ação recomendada

Ao iniciar uma nova sessão GPT/Codex:

```text
1. recuperar v0.19.0 ou a versão posterior realmente existente
2. conferir estado remoto atual
3. reproduzir baseline
4. tentar resolver dependências
5. executar PostgreSQL 17 descartável
6. executar upgrade completo
7. corrigir incompatibilidades reais
8. homologar Auth/runtime
9. executar browser
10. fechar M1
11. iniciar M2 administrativo
```

**Não usar novas features de conveniência como substituto do fechamento do M1.**

---

# 30. Fontes internas recomendadas para anexar ao projeto

Sempre que disponíveis:

```text
HelpDesk_v0.19.0_Vigencia_e_Integridade_Contratual.zip
HelpDesk_v0.19.0_git.bundle
HelpDesk_v0.19.0_Handoff.md
HelpDesk_v0.19.0_Estado_e_Evidencias.md
HelpDesk_v0.19.0_Vigencia_e_Coberturas.md
deep-research-report.md
deep-research-report (1).md
OpenAPI
migrations
manifesto de migrations
README
AGENTS
plano de implementação
```

Se existir uma versão posterior à v0.19.0, ela passa a ter precedência depois de verificada.

---

**Fim do documento mestre.**
