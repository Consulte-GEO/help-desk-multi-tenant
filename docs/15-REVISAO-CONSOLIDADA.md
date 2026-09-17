# Revisão consolidada — Help Desk v0.11.0

**Data:** 16/09/2026 em America/Sao_Paulo; logs de execução em 17/09/2026 UTC.
**Base revisada:** v0.10.0, commit `7acc0e13cba1ee4ee439de35eae4e8413cecc695`.
**Entrega:** incremento local, sem publicação. **M1 aberto; produto completo não entregue.**

## 1. Conclusão executiva

O repositório local reúne um núcleo funcional de atendimento com testes de domínio, HTTP em memória, adaptadores controlados e estado de interface. Isso é um ativo reutilizável, mas não equivale a um serviço operacional implantado. Há uma distância material entre o código acumulado e as condições de produção definidas no projeto: nenhuma migration foi homologada nesta sessão, não há instalação reproduzível de dependências e o navegador não concluiu os testes.

A inspeção remota desta rodada reforça a distinção: GitHub vazio; nenhuma tabela nos cinco schemas consultados e nenhuma migration listada no Supabase; Netlify com o deploy manual antigo de uma página, sem Functions. Portanto, os recursos das versões 0.1–0.11 não devem ser apresentados como já disponíveis no site.

A continuidade desta rodada fechou três classes de divergência reproduzidas: validação de identificadores na autenticação/persistência, texto incompatível com persistência e verificação do vínculo de cada item das conversas ao recurso autorizado. Acrescentou também filtros de responsabilidade ao fluxo existente, sem novas tabelas, grants ou migrations.

## 2. Base documental e alcance da revisão

As fontes solicitadas foram preservadas em `docs/research/RELATORIO-A-ORIGINAL.md` e `RELATORIO-B-ORIGINAL.md`. A revisão utilizou o histórico Git recuperado do bundle, arquitetura, plano e documentos de estado até a v0.10.0; não inferiu implantação a partir das narrativas de entregas anteriores.

Os relatórios recomendam produto independente, API própria, separação de workspace/conta/produto/contrato, autorização contextual, snapshots de regras, separação pública/interna e processamento externo recuperável. O primeiro enfatiza a conta como fronteira; o segundo explicita também workspace. O desenho consolidado mantém as duas fronteiras: workspace da operação e conta atendida dentro dela. O contrato não vira tenant.

O código foi revisto por camadas: domínio e autorização; serviço de aplicação; HTTP/serialização; autenticação humana e M2M; PostgreSQL, transações, segurança de inicialização e migrations; interface e estados assíncronos; runners, manifesto e critérios de homologação; documentação/contrato e demonstração. A suíte da base foi executada antes de alterar o código. Revisão do SQL é leitura e análise de testes escritos, não execução ou certificação de sua semântica.

Não houve revisor independente, subagente, pentest, teste de carga, inspeção de todos os dados de Auth/Storage, auditoria jurídica ou exercício de restauração. O scanner de segredos é heurístico, com padrões limitados. Não foi feita uma nova pesquisa de mercado; somente confirmação pontual na documentação oficial do PostgreSQL para as correções de tipos/texto.

## 3. Matriz do produto: implementado não significa homologado

| Domínio | Implementação encontrada e preservada | Limitação / saída necessária |
|---|---|---|
| Fronteiras de tenancy | Workspace, conta, produto/instância, principal, contrato/versão/cobertura; policies da aplicação e FKs/RLS candidatas | Provar RLS, FKs, grants, helpers e revogação com login restrito no banco real |
| Identidade humana | Formulário e código Supabase Auth; tradução de Auth ID para principal próprio; vínculos lidos do banco | Auth/pooler/expiração e UX reais; logout humano atual limpa estado local, sem revogação humana no provedor ou refresh automático. Cadastro, convites, recuperação e administração não entregues |
| Integração M2M | Credencial própria, hash, sessão curta, escopos e encerramento da sessão atual | Provisionamento/rotação administrativos e conector real pendentes; não é sessão incorporada por usuário externo |
| Catálogo e contratos | Descoberta autorizada, resolução única/ambígua/sem cobertura e revalidação na criação | CRUD/versionamento administrativo e publicação de contratos não entregues; sem intake quando não há cobertura |
| Tickets | Abertura, leitura, busca e filtros, cursor, estado, prioridade e assumir/liberar para si | Operação testada em memória; filas, participantes, transferência arbitrária e merge não implementados |
| Conversas | Mensagens públicas e notas em tabelas/endpoints diferentes; histórico paginado | Proteções SQL e browser pendentes; nova validação de vínculo em cada linha reduz dependência exclusiva do adaptador |
| Concorrência/reenvio | If-Match, idempotência, reautorização de cache, confirmação de COMMIT e descarte de resultado incerto | Locks, unicidade, gatilhos diferidos e falhas de conexão precisam de PostgreSQL real |
| Notificações | Intenção de outbox junto à transação de domínio; atribuição interna não gera evento externo | Não há dispatcher, delivery ledger, retry operacional, e-mail ou webhook enviados |
| SLA | Snapshot e motor de calendário de referência em `src/domain/calendar.ts` | Não há clocks operacionais, início/pausa/retomada, escalonamento ou recalculador de SLA; o arquivo não constitui o módulo |
| Anexos | Requisito e arquitetura documentados | Upload, quarentena, antimalware, promoção, URLs e restore de objetos não implementados |
| Telemetria | Projeção fechada de logs HTTP, correlação, CLI de resumo offline | Não é OpenTelemetry completo, dashboard, auditoria durável ou coleta de produção homologada |
| Interface | Caixa, abertura guiada, detalhe, notas, prioridade, responsabilidade, histórico e estados protegidos | Estado puro/HTTP não comprovam DOM, teclado, acessibilidade, 390px ou autenticação real |
| Infra e CI | Netlify adapter, arquivo de CI, drivers/guards, checks e runners Docker/native | CI remoto não executado; jobs atuais não incluem browser/bundle; imagem PostgreSQL ainda por tag; sem lock/audit |
| Upgrade/DR | Manifesto e ensaio escrito de 001–007 → 008 com snapshots anteriores | Ensaio não executado; upgrade não é backup/restore; RPO/RTO/residência/retenção operacionais exigem decisão |
| Genericidade | Fixtures de laboratório e escola sem colunas específicas no núcleo | Não são os dois conectores reais exigidos pelo critério de aceite |
| Administração M2 | Escopo e plano | Não implementada; produto ainda depende de provisionamento técnico controlado |

Não foi atribuído percentual de conclusão: os requisitos não possuem esforço/ponderação aprovados e não seria honesto usar quantidade de testes, arquivos ou versões como percentual do sistema.

## 4. Evolução acumulada e decisões diferentes da pesquisa

A fundação 0.1 estruturou domínio/API e migrations. As versões 0.2–0.4 reforçaram limites, idempotência, estado assíncrono, transações e sessões. As versões 0.5–0.9 acrescentaram catálogo, observabilidade inicial, busca, prioridade, histórico e atribuição. A 0.10 acrescentou o contrato de metadados do banco, integridade de migrations e ensaio de upgrade. A 0.11 revê as fronteiras dessas camadas e completa a consulta de responsabilidade.

Partes de HD-301/302 (operação) foram antecipadas enquanto M1 estava aberto. Isso não encerrou M1, não entregou M2 nem o conjunto de M3. A ordem de homologação deve voltar ao caminho crítico em vez de acumular interfaces sobre SQL não exercitado.

| Pesquisa/recomendação | Implementação efetiva | Interpretação correta |
|---|---|---|
| Fastify/Node; antes também Edge Functions | Handler TypeScript Request/Response e adaptador Netlify | Escolha de transporte; não declarar Fastify instalado ou servidor Netlify homologado |
| Vitest e pgTAP | node:test; SQL preparado com pg e login restrito | Ferramenta distinta; testes negativos importam, mas mocks não substituem o banco |
| Full Text Search | Substring literal Latin-1 por assunto/UUID | Sem relevância linguística, remoção de acentos ou busca em notas; não é FTS |
| PGMQ/outbox/worker | Estruturas de outbox e intenção transacional | Nenhum processamento ou entrega externa operacional |
| OpenTelemetry | Registros HTTP fechados e CLI offline | Não há tracing distribuído, propagação até delivery ou armazenamento durável |
| Separação de notas aprimorada na segunda pesquisa | Tabelas, endpoints e projeções separados | Direção implementada e preservada; exige testes reais de isolamento |

A documentação original não foi reescrita para esconder diferenças. Recomendações originais, decisões da implementação e evidências observadas permanecem identificáveis.

## 5. Achados reproduzidos e correções

### REV-01 — fronteira de IDs aceitava aliases de demonstração

O validador genérico compartilhado aceitava nomes simbólicos em respostas humanas/privadas destinadas ao PostgreSQL. Um teste de memória podia passar com `person` ou `workspace`, embora o caminho persistido use UUIDs. Corrigido com `uuidIdentifier` nos limites de Auth/principal e checagem de seletores do adaptador SQL. Recurso com ID impossível não dispara SELECT do recurso e termina sem dados (404); seletores inválidos são recusados antes do helper correspondente.

A API escolhe UUID hexadecimal com hífens e normaliza caixa; o PostgreSQL aceita formas alternativas, mas isso não obriga a API a aceitá-las. O ID do usuário Supabase **continua distinto** do ID do principal do Help Desk e é traduzido por `resolve_human`, não forçado a ser igual. Aliases permanecem permitidos em domínio puro/fixtures locais, nunca como identidade validada do ambiente real. Não foi constatada promoção de privilégio remota por esse achado.

### REV-02 — texto aceito localmente não era persistível

NUL e surrogate UTF-16 isolado eram aceitos em alguns textos de criação/conversa. O PostgreSQL documenta que NUL não pode ser armazenado em tipos textuais. A nova validação recusa essas entradas com erro 400 antes de alterar o estado da aplicação. Não faz limpeza silenciosa: conteúdo válido, emoji, acentos, quebras de linha e tabs continuam preservados. Limites anteriores de tamanho não foram ampliados na entrada.

Fontes externas verificadas nesta rodada: PostgreSQL 17, `https://www.postgresql.org/docs/17/datatype-character.html` (NUL) e `https://www.postgresql.org/docs/17/datatype-uuid.html` (representação UUID). A verificação documental não é execução do banco.

### REV-03 — autorização do pai sem conferência de todos os filhos

O serviço autorizava o chamado e confiava que o adaptador devolvesse somente mensagens/notas/eventos desse recurso. Uma resposta controlada incorreta do adaptador reproduziu a falta de revalidação. Agora cada página é verificada antes da serialização: workspace, conta, chamado, identificadores, duplicatas, data, corpo e visibilidade/tipos internos. O chamado devolvido pelo adaptador também precisa ter o ID solicitado.

Uma página inconsistente gera `503 invalid_conversation_result` com mensagem segura, não uma lista parcialmente aceita. Isso é defesa adicional da aplicação; não substitui RLS, constraints ou validação semântica completa de todas as estruturas retornadas. Os testes de regressão usam adaptador controlado: **não houve evidência de vazamento no Supabase remoto**.

### REV-04 — consulta por responsável ausente

Assumir/liberar já existia, mas não havia filtro operacional para localizar os próprios atendimentos ou os desocupados. Implementado `assignment=mine|unassigned` no GET existente de tickets. O filtro participa do cursor e combina por AND com q/status/priority. É aplicado antes de LIMIT na memória e no SQL candidato.

Somente humanos que sejam administradores ou agentes em ao menos uma conta podem pedir esse filtro. Um perfil misto (agente de A, cliente de B) recebe somente linhas das contas em que é operador; informar B explicitamente é recusado. Clientes, gestores de conta e M2M não consultam esse filtro. Atribuição continua sem conceder leitura. `unassigned` significa coluna nula: não reclassifica silenciosamente alguém revogado como desocupado.

A interface oferece Meus atendimentos/Sem responsável apenas à equipe, limpa esse critério ao trocar de sessão e mantém detalhe/rascunho ao aplicar/limpar filtros. Nenhum nome ou ID adicional de terceiro foi acrescentado ao DTO. As novas verificações DOM estão escritas, não aprovadas.

### REV-05 — acompanhamento e testes acumulados

README/AGENTS/estado do plano possuíam resumos antigos. Foram atualizados e os estados anteriores arquivados. Duas fixtures SQL foram tornadas explícitas por nomes de colunas, evitando dependência posicional após a adição de `assigned_to`; não se afirma que essa forma anterior foi um erro SQL reproduzido. Seis cenários de filtro com banco real foram acrescentados, ainda pendentes. Nenhuma migration anterior foi alterada.

## 6. Evidência desta rodada

A base foi executada: 679 aprovações. As regressões da fronteira falharam 18 de 20 antes da correção; as do filtro falharam 10 de 11. Ambas passaram depois. A suíte completa tem 710 testes locais (31 novos), sem falhas/skips/cancelados na execução final. Os testes antigos de Auth foram ajustados para UUIDs reais de fixture; não foram retiradas expectativas de negação de acesso. Duas anotações de tipo nos novos testes foram corrigidas na revisão.

O HTTP de loopback realizou 32 verificações com persistência de memória. Há 125 cenários SQL escritos (117 principais + oito de upgrade) e 27 verificações de navegador escritas. **SQL e browser continuam sem aprovação nesta sessão.** O banco ficou bloqueado por Docker ausente; o browser por `ERR_BLOCKED_BY_ADMINISTRATOR` antes das asserções.

`npm run deps:resolve` tentou o registry e recebeu EAI_AGAIN. Não há lockfile real, npm ci/audit concluídos. Typecheck com ferramentas globais é suplementar; `npm run verify` padrão continua falhando por dependências/tipos locais ausentes. Logs e resultados estão no documento 04 e em `evidence/review-v011/`. Contagens de testes não são estimativa de cobertura nem atestação independente.

## 7. Estado remoto observado (somente leitura)

| Destino | Resposta observada | Limitação |
|---|---|---|
| GitHub Consulte-GEO/help-desk-multi-tenant | Repositório vazio | Não houve push de nenhum incremento |
| Supabase xaelbntjnvztznnpcvtm | Zero tabelas nos schemas public/helpdesk_core/helpdesk_auth/helpdesk_integration/helpdesk_audit; zero migrations listadas | Não é inventário de Auth, Storage, backups ou todos os schemas |
| Security Advisor | Duas advertências para public.rls_auto_enable(): EXECUTE por anon/authenticated como SECURITY DEFINER | Correção continua apenas candidata na migration001; não aplicada |
| Netlify ee32e955-42e5-4417-bf4f-39cbef2366cc | Deploy6aa9cd6dab04ec2cdc23c0b4 manual, uma página, sem Functions ou commit | Não corresponde às versões locais acumuladas |

Advisor observado em 17/09/2026 02:45:23 UTC. Links oficiais de remediação: `https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable` e `https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable`. Nenhuma credencial/segredo retornado por conectores foi copiado para as evidências.

## 8. Ordem recomendada de execução e critério de parada

| Ordem | Entrega verificável | Aceite antes de avançar |
|---|---|---|
| 1 — HD-101 | Resolver dependências em registry autorizado, lock revisado, npm ci, verify e audit | Instalação reproduzível; sem substituir tipos declarados por globais |
| 2 — HD-102 | PostgreSQL17 descartável, oito migrations e 125 casos; fresh e upgrade | Todos executados com papel restrito; corrigir a causa dos achados, nunca remover asserts |
| 3 — HD-103 | Auth humano/M2M, pooler/TLS e bundle/execução Functions | Sessões/revogação, IP confiável, permissões e resultados transacionais reais |
| 4 — HD-104/105 | Browser, carga e limites | 32 HTTP + 27 browser sem skips; UX/teclado/mobile e capacidade medidos, não presumidos |
| 5 — M2 | Bootstrap, vínculos, catálogo e contratos administrativos | Mudanças auditadas, convites/permissões/revogação e publicação de versões testados |
| 6 — M3/M4/M5 | Operação completa, dispatcher/notificações; SLA/roteamento; anexos | Entrega externa rastreável, calendários/clocks e arquivos isolados com lifecycle |
| 7 — M6/M7 | GeoLab + segundo consumidor e critérios operacionais | Integrações reais, restore DB/objetos, residência/retenção/RPO/RTO e liberação explícita |

O plano não assume que basta fechar M1 para o produto estar pronto: o caminho originalmente requerido termina numa entrega externa confiável e em dois consumidores reais. M1 também não deve ser mantido artificialmente aberto por falta de mais features: sua próxima ação é executar os testes/integradores já preparados em ambiente apto.

## 9. Compatibilidade da entrega

API/interface **0.11.0**, schema exigido **0.9.0**, oito migrations preservadas, 23 tabelas candidatas, 18 operações em 14 caminhos. O novo filtro é opcional; consultas sem ele preservam o contexto anterior de cursor. Validação de IDs/texto ficou mais estrita nos limites descritos, de forma intencional. Nenhuma credencial, conta, segredo, dado ou configuração de MFA remoto foi alterado.


## Nota posterior — v0.12.0
A análise acima é a fotografia da v0.11. A lacuna de refresh e pedido de logout humano recebeu código e testes locais no incremento0.12; ver documento16. Não reclassifica Auth real/MFA/SSO, banco, navegador ou M1 como homologados. Estados atualizados em04/05.
