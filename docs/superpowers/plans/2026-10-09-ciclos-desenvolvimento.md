# Help Desk Consulte GEO — ciclos integrados de desenvolvimento

> **Execução:** `superpowers:executing-plans`, na sessão corrente, sem presumir chats ou implementadores paralelos. Manter registro de decisões, RED/GREEN e revisão independente antes da integração. Este documento reorganiza a execução; não substitui os requisitos do plano original.

**Objetivo:** sair das entregas locais fragmentadas para incrementos integrados e verificáveis, até o piloto controlado Novo GEO + portal direto. Legado permanece V2.

**Arquitetura:** núcleo independente; perfil CONSULTE_GEO versionado; conector Novo GEO por API; clientes com BFF OIDC e sessão por pessoa; equipe com Supabase Auth. Persistência privada e autorização por recurso permanecem distintas dos contratos de suporte.

**Stack preservada:** TypeScript/Node 22, pg8.16.3 no lock, PostgreSQL 17/Supabase, Netlify Functions e frontend HTML/CSS/JS.

**Fonte vinculante:** `plano_original/Plano_Implantacao_Original.txt`, cópia do plano fornecido pelo usuário. A especificação adaptada e os contratos complementares citados nele não foram recuperados nesta rodada. Campos, endpoints e decisões que dependem dessas fontes continuam pendentes.

**Referência remota consultada em 09/10/2026:** PR26, draft, `review/cg01-cg02-20261009`, HEAD `f60baed8022b28e067a702b3dd51031e86983017`; base `796face60367e2573d112b7ae42d570055474348`. CG03E–I estão no pacote local, não no HEAD.

## 1. Cadência solicitada: sessões de pelo menos 60 minutos

Reservar **blocos de 90 minutos**, com **mínimo de 60 minutos por sessão de desenvolvimento**. São unidades de organização do trabalho, não prazos de entrega de funcionalidades nem comprovação de tempo já trabalhado. Um ciclo pode precisar de várias sessões; a lista abaixo não significa que cada recurso inteiro cabe em uma hora.

| Parte do bloco de 90 minutos | Reserva de trabalho | Resultado observável |
|---|---:|---|
| Revisar estado, contratos e objetivo da sessão | 10 min | Base e escopo registrados; não reaplicar trabalho anterior. |
| Reproduzir problema ou escrever os testes negativos | 15 min | RED real, separado de falha de ambiente. |
| Implementar o incremento integrado | 35 min | Código utilizável no caminho previsto, sem fallback de aprovação. |
| Executar integração e regressões aplicáveis | 20 min | Logs da fonte atual; ambiente e limites identificados. |
| Revisar, registrar situação e preparar entrega | 10 min | Diferença entre implementado, testado, integrado e operacional. |

Ao fim do bloco, continuar no mesmo ciclo quando seu critério não foi atingido. Não abrir outra letra de CG03 só para apresentar uma nova contagem de testes. Correções necessárias continuam sendo commits revisáveis dentro do ciclo maior.

Um bloqueio externo não deve ser preenchido com espera artificial nem contornado. Usar o tempo útil em diagnóstico, revisão do mesmo incremento e preparação da execução autorizada. Registrar o ciclo como **bloqueado**, não concluído. Nenhum trabalho fica implicitamente agendado fora da sessão ativa.

## 2. Situação inicial e decisão de prioridade

| Camada | Situação comprovada ou registrada |
|---|---|
| PR26 / CG03D | Código remoto candidato. CI histórico D: 1971 Node / 258 SQL / 129 interface. Esses números pertencem somente àquela fonte. |
| CG03E–I | Fonte cumulativa local com 60 arquivos alterados. O pacote I registra 393 testes focais; não é clone completo nem CI integral. |
| SQL E e G | 15 + 16 cenários escritos; ainda não executados no PostgreSQL nesta rodada. |
| Migration nova / upgrade | Não gerados ou aprovados para E–I. As 12 migrations anteriores permanecem imutáveis. |
| Contrato Novo GEO / identidade real | Não qualificados. Não fabricar endpoints, issuer, associação por e-mail ou dados de piloto. |
| Preview, revisão independente e evidência canônica | Pendências registradas. Publicação não é autorizada pelo plano de ciclos. |

**Decisão:** o primeiro trabalho é validar a composição E–I e fechar suas lacunas de integração. Não avançar diretamente para telas administrativas ou SSO enquanto o incremento que lhes dá autorização continuar apenas simulado.

## 3. Restrições globais preservadas

- Separar workspace, conta, produto/instância, contrato/versão, tenant de origem e recurso externo.
- Não acessar o banco GEO para armazenar tickets ou substituir sua API.
- Não autorizar por e-mail, header, metadata de usuário ou `AcessaTodasObras`.
- Manter os scopes de Thiago `contexts:resolve` e `tickets:read`; nenhuma autoelevação.
- Preservar as 12 migrations e seus hashes. Novas migrations somente pela CLI, com manifesto/schema/readiness e upgrade correspondentes.
- Nenhum login normal de aplicação com postgres, service_role, BYPASSRLS ou propriedade do domínio.
- Preservar TLS, quotas, contexto transacional, notas privadas e snapshots históricos.
- Produção existente é o único destino hospedado; testes locais/CI descartáveis não autorizam recursos cloud adicionais.
- Não ampliar o significado de testes sintéticos, testes focais, fingerprint ou comentário em PR.
- Não reenviar o SQL cuja gravação foi bloqueada por outro caminho, codificação ou ação.
- Não desligar gates, modificar contagens esperadas ou importar CI antigo para aprovar fonte nova.

## 4. Mapa dos ciclos e dependências

**Todos os ciclos usam sessões de no mínimo 60 minutos, preferencialmente os blocos de 90 minutos acima.** Cada ciclo pode abranger várias sessões e branches menores previstas no plano original.

| Ciclo | CG de origem | Entrega integrada | Dependências para concluir |
|---|---|---|---|
| C01 — Consolidação E–I e prova SQL | CG02 / CG03 | Uma fonte coerente, SQL E/G executado, regressões e evidência atual. | Checkout completo, PG17 e fluxo autorizado de código. |
| C02 — Contrato da origem e identidades externas | CG01 / CG03 | Contrato verificado, mapping issuer/sub e vínculos sem identidade Supabase fictícia. | Acesso à origem e suas decisões; usar a base validada C01. |
| C03 — Migration e autorização integrada às rotas | CG03 | Persistência/promotora qualificada, revisões vinculadas e ACL efetiva por HTTP/SQL. | C01 + C02; CLI, upgrade e revisão. |
| C04 — Capabilities, MFA e membros | CG04a/b | Administração de membros com alçadas, revogação e sucessão. | C03 + modelo MFA de CG02. |
| C05 — Contas, catálogo e contratos | CG04c/d | Configuração auditável de contas, bindings, produtos e cobertura. | C04 e política de administração aprovada. |
| C06 — Login Novo GEO e portal direto | CG05 | BFF OIDC, sessão por pessoa e ciclo seguro de rotação/saída. | C02–C05 e contrato real de identidade. |
| C07 — Catálogo versionado e formulários | CG06a/b/c | Schema de formulário publicado, validação e editor/preview. | C05 e taxonomia realmente recuperada/aprovada. |
| C08 — Workflow, prioridade e relógios | CG08a/b + CG09a/b/c | Transições, devolutiva e clocks auditáveis da versão do perfil. | C03/C05/C07 e políticas de negócio aprovadas. |
| C09 — Anexos privados e análise de arquivos | CG07a/b | Upload/recibo/quarentena/scan/download efetivamente integrados. | C03–C05 e escolha/aceite dos provedores. |
| C10 — Abertura estruturada e rascunhos | CG10a/b/c | Prévia, commit, protocolo, draft e reconciliação do envio. | C06–C09 completos para o escopo anunciado. |
| C11 — Aprovação e revisão de devolutiva | CG11a/b | Decisões por pessoa e revisão do formulário com histórico. | C08/C10, alçadas e canais aprovados. |
| C12 — Notificações e operação do worker | CG12a/b/c | Ledger, destinatários, entrega/reconciliação e painel. | C10/C11 + provedor/canal de CG01. |
| C13 — Portal, filas e relatórios | CG13a/b/c + CG16a/b | Jornada cliente/equipe, contadores SQL e export autorizado. | C03/C08/C10–C12; fontes reais das métricas. |
| C14 — Capacidades adicionais da coorte | CG14 / CG15 / CG17 | Pacotes, conhecimento/CSAT e GTC, em trilhas independentes. | Somente os módulos que o piloto efetivamente anunciar. |
| C15 — Segurança, capacidade e recuperação | CG18a/b/c | Provas operacionais, restauração e contenção do escopo. | Todas as funcionalidades escolhidas para o piloto. |
| C16 — Piloto real e liberação por escopo | CG19 | Aceite por pessoa/conta/instância/categoria/canal e operação monitorável. | C15 + responsáveis + coorte real. |
| C17 — Expansão controlada V1 | CG20 | Categorias/canais adicionais completos, sem ativação automática. | C16 estável e dependências próprias de cada anúncio. |
| C18 — Legado e eventual histórico | CG21 | Consumidor V2 seguro; histórico somente com autorização própria. | V1 aceita, acesso/contrato legado e plano específico. |

A ordem é de dependências e prioridade, não uma promessa de datas. C09 pode ser trabalhado antes de C08 depois de suas dependências; isso não presume executores paralelos. C14 é condicional: ENC exige sua entrega de pacote, CSAT exige seu módulo, GTC automático exige contrato/adapter; não bloquear abertura humana básica por GTC não anunciado.

## 5. Ciclo C01 — execução iniciada

### Objetivo de saída

Executar a composição E–I em checkout completo e PG17 descartável, com fonte e logs coerentes. Corrigir somente achados reproduzidos e manter o atendimento fechado. O verificador de pré-requisitos abaixo não substitui essa saída.

### C01.1 — Reconciliar o material existente

**Entradas:** PR26/f60baed; pacote `HelpDesk_CG03I_Local_Entrega_2026-10-09.zip`, SHA256 `39fc3cdddd3733057cc3495fa610c58ffadc4a06b642148d5e1cea538ec72e7c`.

- [x] Conferir HEAD remoto, estado draft e hash do pacote.
- [x] Conferir os 60 arquivos declarados no manifesto da entrega local.
- [ ] Obter checkout completo no fluxo autorizado; preservar `AGENTS.md`, package e lock verdadeiros.
- [ ] Em base exata f60baed, conferir/aplicar **somente** `CG03EFGHI_LOCAL_incremental_sobre_f60baed.patch` do pacote I. Em outra base, reconciliar o diff antes.
- [ ] Reavaliar consumidores de `runTransaction`: erros opcionais, SAVEPOINT e callbacks que absorvem rejeições. Não alterar esses fluxos apenas para manter testes verdes.

### C01.2 — Diagnóstico executável de pré-requisitos (implementado nesta rodada)

**Arquivos novos:**
- `scripts/cg-consolidation-core.mjs`: inspeção de arquivos declarados, inventário/hash das migrations e versões observadas.
- `scripts/check-cg-consolidation.mjs`: interface local, consulta de versão de ferramenta e leitura de metadados de dependências.
- `docs/operations/CG03I-CONSOLIDATION-INPUTS.json`: referência congelada dos 60 arquivos I e das 12 migrations originais.
- `tests/cg-consolidation.test.ts` e `tests/cg-consolidation-cli.test.ts`: testes do diagnóstico.

**Interface:** `inspectConsolidation(root, spec, tooling): Promise<ConsolidationPreflight>` retorna `blocked` ou `ready_for_existing_runners`; `sqlExecuted`, `ciExecuted` e `productionApproved` permanecem sempre `false`.

- [x] RED do núcleo antes da implementação: 32 falhas pela interface ausente.
- [x] GREEN do núcleo: 32 testes aprovados.
- [x] RED da CLI antes da implementação: 8 falhas pela entrada ausente.
- [x] GREEN combinado: 40 testes aprovados.
- [x] Executar diagnóstico real sobre o recorte local: 60/60 arquivos coincidem; checkout mínimo incompleto, 12 migrations ausentes, PG17 e dependências não verificados. Saída `blocked`, exit2.
- [ ] Executar no checkout completo da fonte candidata e resolver seus bloqueios legítimos. Saída0 significa apenas que os pré-requisitos examinados foram encontrados.

```sh
node --experimental-strip-types --test --test-reporter=tap \
  tests/cg-consolidation.test.ts tests/cg-consolidation-cli.test.ts
node scripts/check-cg-consolidation.mjs --root .
```

**Resultado esperado do primeiro comando:** testes verdes, sem skips. **Do segundo:** exit2 e lista de pendências quando o ambiente não estiver pronto; exit0 não é aceite SQL/CI.

### C01.3 — Executar SQL e composição, sem simulações substitutivas

**Arquivos existentes a revisar/executar:**
`supabase/candidates/cg_resource_scope.sql`, `cg_resource_observation.sql`, `cg_resource_publication.sql`; `supabase/tests/resource-access-scenarios.ts`, `resource-scope-store-scenarios.ts`, `resource-publication-scenarios.ts`; registrador `capacity-scenarios.ts`; `rls.test.ts` e `upgrade.test.ts` do checkout integral.

- [ ] Ler os scripts originais de provisionamento/testes antes da execução. Manter banco `helpdesk_test`, localhost, roles restritos e guards.
- [ ] Conferir o registro dos cenários E/G após o guard do runner; não aceitar importações que nunca executam os testes.
- [ ] Executar os 15 cenários E e 16 G escritos, incluindo rollback de grant/observação/recibo após erro de argumentos do driver capturado pelo callback.
- [ ] Identificar separadamente falha de setup, sintaxe, contrato, autorização, concorrência e asserção.
- [ ] Se houver achado, reproduzir RED, corrigir causa e repetir todas as regressões aplicáveis. Não transformar uma ausência de schema em recusa autorizada fictícia.
- [ ] Exercitar publicação → persistência → conferência da lease → leitura/mutação de ticket. Não validar os módulos apenas isoladamente.
- [ ] Verificar A+B/A+C, tenants com ID repetido, notes-only, replay, revogação concorrente, precisão temporal, conexão devolvida limpa e COMMIT desconhecido.
- [ ] Registrar o que o upgrade antigo cobre e o que pertence à futura migration nova. C01 não promove o candidato automaticamente.

**Execução:** usar `npm run test:db:native` ou `npm run test:db:local`, conforme os pré-requisitos já previstos nesses scripts. Não criar outro executor, apontar a DSN à produção ou alterar o guard para usar PG de outra versão.

### C01.4 — Regressão integral, evidências e entrega revisável

- [ ] `npm ci` com package/lock verdadeiros; não copiar dependências de um harness.
- [ ] Executar os scripts existentes `check:lock`, `check:migrations`, testes, tipos, contratos, segredos e build.
- [ ] Executar a interface pelo runner existente; manter a ocorrência histórica de `notes-retry` em triagem até causa/correção próprias.
- [ ] Executar `npm run homologate:local` e `npm run check:homologation` conforme o contrato real dos scripts e seus pré-requisitos. Confirmar que as saídas pertencem à fonte atual.
- [ ] No fluxo autorizado, gerar CI atual; conferir run/attempt/artefato/digest/fingerprint/logs e incorporar a evidência canônica correspondente.
- [ ] Revisão independente do conjunto. Autorrevisão é um estado diferente, não uma aprovação substituta.
- [ ] Resolver o preview com log completo. Não concluir sua causa exclusiva a partir de `exit2`.

**Saída de C01:** composição técnica testada e pronta para revisão/integração autorizada, com bloqueios externos explicitados. **Não inclui:** aprovação do Novo GEO real, migration produtiva, usuários de piloto ou abertura do atendimento.

## 6. Critérios por ciclo seguinte

### C02 — Contrato da origem e identidades externas

Recuperar spec/análise/matriz originais e inspecionar repositório, OpenAPI e discovery do Novo GEO. Comparar issuer/sub/audience, PKCE/BFF/refresh/delegação e atualização de permissões com o desenho aprovado. Se a origem divergir, registrar ADR antes de adotar alternativa. Implementar mapping sem união por e-mail ou UUID Supabase fictício e testar usuários antigos. **Conclui:** contrato e identidades possuem evidência e procedência; valores sintéticos não são configuração real.

### C03 — Migration, revisões e rotas

Promover candidatos por CLI; completar constraints/FKs/privilégios, schema/manifest/readiness e upgrade. Vincular revisões da autoridade e persistência na transação e integrar handlers. **Conclui:** acesso direto SQL e HTTP nega C, A+C e tenant vizinho antes de paginação/contagem/recibo; não apenas teste unitário. Não habilitar criação genérica sem recursos.

### C04 — Administração de membros

Executar as branches04a e04b, com capability administrativa distinta dos cinco scopes de negócio, MFA comprovado no servidor, lista/convite/expiração/revogação e sucessão. **Conclui:** AAL1, admin sem capability, autoelevação, conta vizinha e remoção do último administrador são recusados por HTTP/SQL; fluxos legítimos passam em browser. Não aumentar os scopes de Thiago.

### C05 — Configuração da operação

Executar04c/04d, não um setter SQL genérico. Configurar contas/bindings/catálogo/contratos/coberturas por UI e comandos auditados; preservar versões publicadas. **Conclui:** administrador autorizado configura a operação sem SQL manual rotineiro e cliente não chama rotas administrativas diretamente. Dados reais da coorte exigem escolha própria.

### C06 — SSO e sessões por pessoa

Executar CG05 somente com contrato verificado. Cobrir state/nonce/PKCE/issuer/audience/JWKS, rotação, revogação, geração da sessão e resposta tardia. **Conclui:** percurso sintético inteiro passa; login real de duas pessoas autorizadas possui aceite separado. Browser não recebe credencial M2M nem token persistente no storage/URL.

### C07 — Formulários versionados

Executar06a/b/c: catálogo draft da fonte, DSL limitada, CNPJ numérico/alfanumérico, condicionais/repeaters/lookup/arquivos, editor e prévia. **Conclui:** validação cliente/servidor concorda, campos/tipos não suportados impedem publicação e formulário antigo continua usando sua versão. Não inventar a taxonomia ausente para preencher nove categorias.

### C08 — Workflow e relógios

Executar08a/b e09a/b/c;08c somente se exigido. Preservar estados e histórico do core e fixar versão do perfil. **Conclui:** resolução exige conteúdo, transferência não encerra correção, primeira resposta é humana elegível e calendários/pausas/violação são reproduzíveis. Scheduler permanece desativado até aprovação das políticas e canais.

### C09 — Arquivos privados

Executar07a/b com provedor escolhido e scan real. **Conclui:** anexo pending/rejeitado/estrangeiro não satisfaz requisito; download revalida pessoa/recurso; MIME/hash/tamanho/quarentena são demonstrados no pipeline. Stub não retorna clean em produção.

### C10 — Intake e rascunhos

Executar10a/b/c, compondo identidade, formulário, arquivo, cobertura, prioridade e workflow na mesma intenção. **Conclui:** prévia não autoriza um commit posterior alterado, replay conserva protocolo, resultado desconhecido preserva key/payload e usuário não perde draft fora da audiência autorizada. Abre-em-nome exige beneficiário verificado.

### C11 — Decisões e devolutivas

Executar11a/b com revisão e escopo vinculados. **Conclui:** convite antigo, revisão alterada, token reusado, scanner GET e beneficiário errado não decidem; retorno elegível mantém responsável e história. Não atribuir poder no GEO por aprovação no Help Desk.

### C12 — Entrega e operação do worker

Executar12a/b/c: leases/ledger, destinatários/templates/canal, reconciliação/painel. **Conclui:** accepted, delivered, failed e unknown são distintos; destinatário revogado e nota privada não são enviados; interrupções não reinventam intenções. Worker/provider/custos dependem de aceite, não só de um cron configurado.

### C13 — Jornada cliente/equipe e informação gerencial

Executar13a/b/c e16a/b com DTOs e consultas autorizadas. **Conclui:** filtros/totais abrangem o universo SQL correto, nota antiga sai do DOM na troca de audiência, desktop/mobile/teclado passam e export revalida acesso. Métrica inexistente aparece indisponível, não zero.

### C14 — Trilhas opcionais do piloto

Separar14(pacotes),15a/b/c(conhecimento/macros/CSAT) e17a/b(GTC). Cada trilha tem sua dependência e aceite. **Conclui:** somente capacidades completas entram no manifesto da coorte; done externo sem publicação não fecha ticket; pacote tem procedência; CSAT não dá leitura de chamado.

### C15 — Provas operacionais

Executar18a/b/c: segurança/Auth, capacidade hospedada, recuperação/retencão/contingência. **Conclui:** restores são exercidos no procedimento autorizado, counts/hashes conferem, entregas antigas não se repetem, limites/custos/responsáveis são aceitos. Não restaurar sobre produção por impulso.

### C16 — Piloto e liberação

Executar CG19 com pessoas, contas, obras, categorias e contratos realmente escolhidos. **Conclui:** jornada completa e negativas cruzadas passam; release, CI, schema, deploy e evidências correspondem; fora da coorte continua fechado; existe decisão de contenção. Somente aqui registrar operacional no escopo aceito.

### C17 e C18 — Expansões posteriores

CG20: publicar categorias/canais somente com dependências próprias, incluindo inbound, assistência anônima ou IA apenas em subplanos específicos. CG21: V2 legado com namespace/identidade seguros; histórico importado é somente leitura, sem grants ativos ou notificações retroativas. **Concluem:** cada expansão tem aceite separado; Novo GEO + legado não comprova genericidade em outro domínio.

## 7. Definição de conclusão e bloqueios

Uma sessão termina com registro do avanço; um ciclo só termina com seu critério de saída. O registro deve separar:

`planejado → implementado → testado localmente → testado em PostgreSQL real → testado em navegador → CI verificado → revisado independentemente → integrado → deployado → homologado → operacional`.

Não atribuir automaticamente todos os estados anteriores ou posteriores. Um teste focal pode passar com o ciclo bloqueado; um deploy pode existir com atendimento fechado.

Se faltar ferramenta, fonte ou decisão, registrar causa, evidência e próxima ação objetiva. É proibido declarar um requisito de integração concluído porque existe mais um módulo local. Tarefas independentes podem ser preparadas, mas não anunciar o recurso dependente nem diluir o bloqueio original.

## 8. Situação ao entregar este plano

C01.1 iniciado; C01.2 implementado e testado localmente. C01.3/C01.4 **pendentes**, com diagnóstico real bloqueado. C02–C18 **planejados**, não executados. Nenhum ciclo integral foi declarado concluído e nenhuma duração efetivamente trabalhada de60/90 minutos é certificada por este documento.
