# Help Desk Consulte GEO — plano consolidado V2, orientado a cadastros e execução

> **Execução:** usar `superpowers:executing-plans`, com regressão negativa observada antes da implementação, verificação do conjunto e revisão independente antes de integrar. A implementação inicial desta rodada corresponde à HDN-01a; a publicação operacional das demais etapas não foi autorizada por este documento.

**Goal:** entregar uma central que receba pedidos de cadastro/ajuste completos, permita à Consulte executá-los e conferi-los rapidamente e preserve atendimento, autorização e rastreabilidade por cliente/obra/material.

**Architecture:** core multi-produto existente + perfil Consulte GEO versionado + adaptadores qualificados do Novo GEO. Reutilizar identidade, ACL, sessões, catálogos, DSL, draft/intake, workflow, SLA, revisão, anexos, outbox, portal e piloto. Nenhum acesso direto ao banco GEO ou fallback de produção em memória.

**Tech Stack:** Node22/TypeScript, pg/PostgreSQL17, Supabase/Auth e Netlify Functions + HTML/CSS/JS atuais. Package/lock/schema da base real prevalecem; nenhuma dependência nova nesta rodada.

**Spec:** `docs/requirements/consultegeo/01_COMPARATIVO_REQUISITOS.md`, matriz de 107 códigos, levantamento original de 12/10 e contratos de segurança do plano de implantação anterior. Fatia implementada: `docs/superpowers/specs/2026-10-12-hdn01-execution-checklist.md`.

**Base:** `6f7bc832d504ec1285d6125b68ab83be70c1f57f`. A consolidação R1 já foi integrada e testada, incluindo D/E/G. Não voltar à base f60baed, não repetir patches R1 e não declarar seus antigos 31 cenários como ainda não executados. Novas alterações exigem suas próprias execuções.

## 1. Escopo e prioridade revisados

O levantamento identifica cadastro/ajuste como porta de entrada principal. Adotar esse foco sem tratar a afirmação de volume como medição concluída. Cadastro e a central de execução passam à frente de pesquisa avançada, IA e expansão editorial. HDW-00/00b continua necessária para ingerir seu corpus com segurança, mas não deve bloquear todos os serviços humanos enquanto uma fonte interna está em quarentena.

**Primeiro recorte de integração:** Cadastro de usuário + Dúvida/Relatar problema básicos, com origem confiável, formulário, anexo efetivamente suportado, rascunho, protocolo, central N1, checklist, devolutiva, resolução e notificação rastreável. Um cadastro será executado manualmente por pessoa autorizada na origem; não depende da escrita automatizada da Fase 3.

**MVP completo:** não é sinônimo desse recorte. Os 52 requisitos marcados MVP e as tabelas não codificadas precisam de aceite, adaptação registrada ou exclusão de escopo expressamente aprovada. Implantação, configurações, correções e backup não podem ser anunciados apenas por constarem do menu. O corte operacional deve ser identificado por conta/instância/pessoa/categoria/canal/recursos.

**Fase 2 da fonte:** eficiência operacional (busca, autosave, contexto ampliado, incidente, subtarefa, indicadores, inbound, sinônimos e sugestões assistidas). **Fase 3:** escrita assistida GEO, IA ao cliente, anexos complexos adicionais e canais extras. Legado V2 e importação de histórico mantêm decisão própria depois da V1 aceita; não se confundem com continuidade visual dos números de protocolo.

## 2. Restrições globais e complementos técnicos preservados

1. Workspace, conta, tenant, instância, contrato, obra e material são dimensões distintas. Perfil “Master”, e-mail, grupos pelo nome ou seleção “todas” não concedem cobertura. A/B sem C continua negando A+C integralmente.
2. Fonte de identidade e contexto deve ser qualificada. Observação de navegador/tela/erro não é autorização. Cliente com IdP indisponível usa assistência limitada, não identidade inventada por e-mail.
3. Auth/MFA/role/scopes correntes não são enfraquecidos. Nenhuma capability nova é concedida a Thiago ou à equipe por seed. N3/usuário externo devem ter restrições efetivas no servidor.
4. Doze migrations e hashes históricos imutáveis. Novas migrations geradas pela CLI, com schema/manifest/readiness e upgrade correspondentes. Banco de testes descartável local/CI, não Supabase de produção como bancada.
5. Queries de request em papel restrito, TLS/CA/timeouts/quotas distribuídas e escopo antes de LIMIT/contagem/recibo/arquivo/export. Mesma conexão para identidade, autorização, negócio, auditoria e recibo.
6. Resultado desconhecido preserva chave/conteúdo e não reenvia gravação ou notificação automaticamente. Ato confirmado não vira falha por problema posterior à confirmação.
7. Snapshot e versão publicados são imutáveis. Reclassificação não põe campos privados na descrição pública. Notas, checklist e diagnósticos técnicos têm contratos internos próprios.
8. Nenhum default de prazo, reabertura, pausa, idade de ensaio, limite FCK ou retenção decorre automaticamente da proposta. Manter decisão/versionamento/owner e fonte.
9. Solução não termina só porque bug foi encaminhado; reabertura não apaga consumo ou violação. Automação, checklist, atribuição e notificação não contam como primeira resposta humana.
10. Anexo obrigatório exige pipeline real do formato. DWG/XLSX/vídeo não passam por renomear MIME ou extensão. Scanner de teste não é fornecedor real. Modelos e downloads têm versão, privacidade e validade.
11. Wiki é dado de referência, não instrução executável. Não publicar credenciais, scripts internos, dados de clientes ou conteúdo legado como Novo GEO. As decisões editoriais anteriores continuam pendentes.
12. Publicação técnica e operação do atendimento são marcos separados. Não abrir a flag global enquanto os handlers genéricos contornarem o fluxo novo. Capabilities descrevem apenas o que está montado e verificado.

## 3. Foco obrigatório da revisão

- Reclassificação atravessando audiência e publicando campos antigos; operador com acesso a A que tenta completar A+C; seguidor com acesso parcial.
- Status/finalização pelo endpoint antigo ignorando checklist, aprovação, formulários ou evidência; rascunho cujo template se alterou.
- Respostas/recibos repetidos após revogação, confirmação perdida, concorrência entre analistas, mudança de revisão durante a execução ou reabertura.
- Planilha/DWG/vídeo obrigatórios sem fornecedor qualificado, conta nova sem obra e encerramento que inadvertidamente revoga dados antes da entrega.
- Declaração de “executado”, “entregue”, “resolvido” ou “publicado” sem prova apropriada da origem; texto de IA/wiki tratado como aprovação ou compromisso comercial.

## 4. Mapa de reaproveitamento e correspondência com HDW

| Nova etapa | HDW anterior preservada | Principais componentes existentes | Resultado e prioridade |
|---|---|---|---|
| HDN-00 Reconciliação | Plano/diagnóstico WikiV3 | Matriz RF, HDW-00/00b | Comparativo e decisões explícitas; executado documentalmente nesta rodada |
| HDN-01 Checklist de execução | HDW-08/09 antecipadas | `support-workflow`, transação e ACL | Guarda local implementada; marcação/UI/SQL em seguida |
| HDN-02 Identidade/contexto | HDW-01 | ExternalIdentity/GeoLogin/ResourceAccess | Contratos reais e segregação, P0 antes de operar |
| HDN-03 Persistência/composição | HDW-02 | Candidatos SQL, stores e runtime | Adaptadores duráveis e rotas sem desvios |
| HDN-04 Catálogo/formulários de cadastro | HDW-04 | `form-catalog`, `form-rules`, drafts | Proposta de nove famílias; publicar somente schemas completos |
| HDN-05 Jornada de cadastro e central inicial | HDW-06 ampliada | intake, workflow, portal, on-behalf | Cadastro de usuário e atendimento básico ponta a ponta |
| HDN-06 Cadastros restantes | HDW-08 | forms, lookups, checklist, approval | Traço/fornecedores/laboratório/materiais contextualizados |
| HDN-07 Configuração/correção/reclassificação | HDW-08 | revisão, approvals, profiles | Alçada institucional, impacto integral e histórico seguro |
| HDN-08 Implantação por etapas | HDW-05/09 | attachments, intake, workflow | Arquivos qualificados e etapa/pendência por projeto |
| HDN-09 SLA e notificações operacionais | HDW-10 | clocks, calendário, ledger/outbox | Dados e prazos confiáveis; mínimo integra HDN-05 |
| HDN-10 Backup/encerramento | HDW-11 | package-delivery | Pacote seguro, sem confundir com restore ou desativação |
| HDN-11 Orientação/conhecimento | HDW-00/00b/03/07 | knowledge/editorial/macros | Ajuda mínima curada; expansão paralela, sem bloquear pedido |
| HDN-12 Fila/indicadores mínimos | HDW-12 | portal-query, report/export | Universe SQL autorizado; dados reais, sem métrica inventada |
| HDN-13 Aceite e liberação | HDW-13 | release-manifest/pilot-control | Aceitar apenas o escopo comprovado, sem marcar MVP inteiro por recorte |
| HDN-14 Eficiência Fase 2 | HDW-14 | componentes anteriores | Evoluir a partir de volume/tempos/devolutivas medidos |
| HDN-15 Diferenciais e legado | HDW-14/CG-21 | conectores qualificados | IA/escrita/canais e legado em subplanos separados |

As numerações são unidades de responsabilidade, não uma fila estritamente serial. HDN-02/03 e mínimo de HDN-09/12 são pré-requisitos de HDN-05 operacional; a guarda HDN-01 pode ser implementada/testada sem habilitar uma categoria. Uma equipe não deve adiar a resolução de adaptadores pelo simples avanço numérico das etapas.

## 5. Etapas executáveis

### HDN-00 — reconciliar requisitos e decisões

**Files:** `docs/requirements/consultegeo/{01_COMPARATIVO_REQUISITOS,02_MATRIZ_107_REQUISITOS}.md`, JSON de rastreabilidade e este plano. **Entradas:** levantamento original, plano anterior e estado consolidado. **Saída:** 107 códigos preservados, contribuição/reuso/ajuste e dependências explícitas.

- [x] Conferir 107 IDs únicos e 52/43/12, sem criar RNFs atribuídos ao documento.
- [x] Separar requisitos da fonte, inferências de priorização e restrições técnicas anteriores.
- [x] Registrar D01–D20 e não aplicar automaticamente prazos/permissões/idades.
- [ ] Validar com responsáveis as decisões comerciais/técnicas ainda pendentes; registrar revisão, não apenas conversa solta.

**Aceite:** nenhum requisito desaparece, prioridades originais permanecem visíveis e cada divergência tem resolução explícita ou status pendente.

### HDN-01 — checklist versionado e evidência antes de resolver

**RF:** CEN-07, CEN-11, PRJ-03. **Existentes alterados:** `src/domain/support-workflow.ts`, `src/application/support-workflow.ts`. **Novos desta rodada:** `src/domain/execution-checklist.ts`, três testes e quatro modelos draft em `profiles/consultegeo/execution-checklists.draft.json`.

**Interface entregue:** `parseExecutionChecklistReference`, `parseExecutionChecklistTemplate` e `assertExecutionChecklistComplete`. Perfil fixa id/versão/hash; `WorkflowDecision` exige checklist ao resolver. O adapter privado deve ler o conjunto inteiro pelo ticket e segurar seu estado na mesma transação. Auditoria contém digest/revisão/contagens; público e outbox não recebem itens, motivos ou evidências.

- [x] Negativas e GREEN locais de template/snapshot, pendência/dispensa/risco, identidade/revisão, replay/ACL/ACK perdido e segregação pública.
- [x] Modelos de usuário/traço/usina/laboratório como drafts, sem seed ou aprovação automática.
- [ ] **HDN-01b:** criar store transacional e comandos autenticados de marcação. Arquivos futuros: `src/application/execution-checklist.ts`, `src/infrastructure/execution-checklist-store.ts`, migration aditiva e `supabase/tests/execution-checklist-scenarios.ts`. A transação liga actor, checklistRevision, ticketVersion, profileVersion e recursos; CAS e auditoria de cada mudança. Proibir concluir com checklist de outra revisão, actor declarado ou configuração alterada.
- [ ] **HDN-01c:** UI interna `web/execution-checklist.js`, montagem na ficha com estados pendente/concluído/não aplicável, evidência/motivo/confirmação explícita de risco e erros acionáveis. Não um botão geral “marcar tudo”. Readonly quando não autorizado; salvar/reconciliar a mesma intenção em unknown.
- [ ] Proteger todos os caminhos que alteram status e o runtime antes de anunciar a regra. Uma resolução antiga continua histórica; upgrade define como tratar tickets já resolvidos sem checklist.

**Testes reais de saída:** dois operadores editando a mesma revisão; mudança do ticket durante a espera; nulo/expirado/quebra de lock; recusa em SQL/HTTP direto; dados privados ausentes no portal/e-mail/export; navegador teclado/foco/estado desconhecido. Checkbox não comprova execução no GEO: evidência e responsabilidade continuam explícitas.

### HDN-02 — qualificar identidade, contexto e catálogo da origem

**RF:** PER-01/02/04/06/07/08, ACE-01/02/04/09/12, FOR-02. **Reuso:** `external-identity`, `geo-login`, `resource-access`, `resource-access-store`, `admin-policy` e roteiro HDW-01. **Futuros adapters:** mapping/directory do conector Novo GEO, store de identidades/sessões e contexto.

- [ ] Confirmar repositório/schema/API/discovery e fluxo real de IdP, audience, issuer, grupo e revisão/revogação. O documento mencionar IdentityServer não encerra essa etapa.
- [ ] Mapear cliente/obra/material/papel com fonte e revisão. Modelar master e externos pela capacidade específica, não texto de grupo, e-mail ou condição “usuário interno”.
- [ ] Ler antes de LIMIT/contagem/recibo e tratar A+C como conjunto completo. Modelar implantação sem obra por uma intenção própria ligada à conta, sem lista vazia significando acesso global.
- [ ] Contexto técnico tem origem e nível de confiança: campos capturados no cliente versus campos verificados pela API. Sanitizar erro/trace e mantê-los internos.
- [ ] Preservar redirecionamento normal sem pop-up, callback dedicado e deep link depois do login.

**Aceite:** duas pessoas autorizadas reais exercitam SSO, revogação, contexto e ACL; mesma pessoa aparente por e-mail/issuer diferente não se une. API indisponível recusa autoridade sem inventar grant. Não enviar segredos ao agente ou ao Git.

### HDN-03 — fechar o substrato durável da primeira jornada

**Reuso:** contratos dos stores de member/config/catalog/form/draft/intake/workflow e candidatos D/E/G já testados. **Modificações futuras:** `src/infrastructure/runtime.ts`, adapters específicos, OpenAPI, readiness/schema e migrations geradas via CLI.

- [ ] Revalidar a base real e instalar pelo lock. Conferir que nenhum pacote local já integrado será aplicado novamente.
- [ ] Promover a persistência mínima de identidade/contexto, perfil/formulário, ticket metadata/resposta/checklist, auditoria/outbox/recibos e sequências. Não tentar promover todos os opcionais antes da primeira fatia.
- [ ] Atualizar schema/manifest/compatibilidade coerentemente; preservar 12 migrations originais e testar upgrade sobre dados existentes.
- [ ] Definir cutover de protocolo legado se desejado: inventário/collision checks, namespace/último número, gaps e referência externa. Sem isso, preservar numeração CG atual; não renumerar.
- [ ] Montar o serviço novo com os adapters reais, reaproveitando pool, quotas, TLS/CA e observers. Impedir bypass pelo POST/GET genérico quando o produto exige perfil/recurso/checklist.

**Aceite:** transação e lock no banco real, rollbacks em cada fronteira, replay após perda do ACK, autorização atual antes do recibo, nenhum scope novo ou service_role para request. A execução anterior D/E/G não substitui o upgrade dessa migration nova.

### HDN-04 — catálogo de nove famílias como proposta versionada e formulários executáveis

**RF:** CAT-01/05, FOR-01/02/03/04/07/09/11. **Reuso:** `form-catalog`, `form-rules`, `dynamic-form`, `admin-forms`, `form-draft` e registry de evidências.

- [ ] Registrar as nove famílias do levantamento como drafts e mapear as cinco antigas. Preservar IDs/versões publicadas; não transformar o rótulo em grant.
- [ ] Modelar Cadastro › Usuário por ação; material e beneficiário são referências verificadas. Grupo e obras vêm da origem; seleção “todas” deve materializar o conjunto autorizado completo.
- [ ] Reaproveitar tabela repetível com limites e mensagens por linha. Uma linha inválida não cria metade dos usuários; o Help Desk registra pedido, não executa criação automática nesta fase.
- [ ] Separar validação de formato e validação de regra da origem. Nenhuma idade universal ou faixa técnica sem contrato; detectar duplicidade só quando existir lookup qualificado.
- [ ] Modelos de download e orientação mínima por revisão; mídia/links de origem permitida. Serviço que exige DWG/planilha fica desabilitado até HDN-08 qualificar o formato.

**Aceite:** backend recusa schema/versão/lookup/anexo adulterado; renderer e validador compartilham regras; publicar exige handlers reais e taxonomia revisada. Templates publicados permanecem imutáveis.

### HDN-05 — primeira jornada de Cadastro de usuário e operação N1

**RF:** CEN-01/02/03/04/07/08, CIC-02/03/07/11, ACE-09, FOR-07/12. **Dep.:** HDN-01b/02/03/04 e mínimo HDN-09/12. **Reuso:** intake, workflow, forms/review, approvals, portal/queues e recipients.

- [ ] Abertura pelo próprio solicitante ou analista em nome de beneficiário verificado, com canal de origem: portal/GEO/WhatsApp/telefone/e-mail/reunião. Origem não instala conector de mensagem.
- [ ] Contexto, formulário, anexo suportado, prévia e confirmação; ticket/evento/recibo/protocolo atômicos. Unknown preserva intenção, sem abrir outro protocolo.
- [ ] Central com assumir/atribuir, formulário, conversa e checklist internos; responsável e prioridades por equipe. Dúvida/Problema básicos usam o mesmo fluxo com campos próprios.
- [ ] Execução humana autorizada no GEO, fora de chamada automática do Help Desk nesta fase. Registrar referência/evidência do efeito observado; envio de acesso aceito não vira entregue.
- [ ] Devolutiva com campos apontados, revisão limitada às respostas permitidas e histórico preservado. Resolver somente com resolução e checklist da revisão correta.
- [ ] Conectar e testar a fila humana, o destinatário real, a notificação e o acompanhamento. Não chamar uma UI que só abre tickets de jornada completa.

**Aceite:** uma pessoa real completa o pedido, equipe executa/confere, solicitante acompanha/retorna, recibo não duplica efeito, A/B/C continuam isolados. Sem data/custo/meta de duração prometidos por esta proposta.

### HDN-06 — cadastros de traço, fornecedores, laboratório e materiais

**RF:** FOR-02/03/04/05/08 e tabelas de cadastro; CEN-07/09. **Dep.:** primeira jornada estável e contratos por material.

- [ ] Completar os formulários do levantamento, sem uma tela fixa por material: traço, usina/filial, laboratório, projetista, bloco/graute/argamassa, cerâmica/cabos/fornecedor.
- [ ] Separar novo/vincular/alterar, recurso único da conta e impacto completo sobre obras. Lookup de equivalente sugere seleção explícita, nunca associação automática.
- [ ] Confirmar padrões de moldagem e referências por ensaio/material/obra com a qualidade; não tornar 28 dias obrigatório universalmente.
- [ ] Conferir contatos de programação e laboratório, vínculo de projetista e unidades tipo. “Não sei se integrado” deve virar pendência, não integração presumida.
- [ ] Ligar cada formulário ao template de execução publicado e qualificado; evidência vem da execução humana ou futura API aprovada.

**Aceite:** amostras reais de cada fluxo, fonte/versão registradas, nenhum campo técnico inventado, nenhuma criação/vínculo em duplicidade por reenvio do chamado. Alteração de traço/estrutura exige HDN-07 quando houver impacto institucional.

### HDN-07 — configuração, correção e reclassificação sem perda de segurança

**RF:** CAT-04, PER-02, CIC-03/11 e formulários de Configuração/Correção. **Reuso:** approvals, support-review, snapshots e auditoria.

- [ ] Alçada por conta/material/operação: solicitante, beneficiário, aprovador e executor separados. Autoaprovação somente onde policy expressa permitir; ações críticas podem exigir revisor distinto.
- [ ] Fixar “como está/como deve ficar”, versão da fonte e todos os recursos impactados. Mudança após aprovação invalida a decisão anterior.
- [ ] Reclassificar por comando próprio com mapa de campos permitido, revisão esperada e prévia do impacto em prazo/fluxo. Preservar schema e respostas anteriores.
- [ ] Campos sem correspondência não viram descrição pública. Guardar parte anterior com audiência original; pedir complemento quando destino não satisfaz campos obrigatórios.
- [ ] Controles de execução sensível registram motivo/evidência/reconhecimento; não executam scripts, exclusão ou reenvio como diagnóstico.

**Aceite:** troca entre categoria pública/interna não vaza; aprovação encaminhada/antiga não funciona; reclassificação não apaga violação/compromissos; registro de laudo/NC não é removido para destravar atendimento sem autorização própria da origem.

### HDN-08 — implantação e ajustes como projeto, com arquivos reais

**RF:** FOR-09/10/11, PRJ-01/02/03/04/08 e tabelas de implantação. **Reuso:** attachments/scan, draft/intake, checklist e workflow.

- [ ] Qualificar formatos exigidos: planilha modelo por material, projeto DWG e imagens; limites, MIME/bytes, macros/encriptação, scan/preview e política de retenção. Não executar arquivos ou fórmulas. DWG não vira texto para fingir suporte.
- [ ] Nova obra usa intenção autorizada da conta antes do ID externo; ligar a obra real depois preservando provenance/versão.
- [ ] Instanciar plano com etapas do documento e dependências; responsáveis e prazos vêm de política publicada, não de divisão automática dos sete dias propostos.
- [ ] Alteração de estrutura registra diff e impacto; nunca usar recriação destrutiva como solução padrão em obra com lançamentos.
- [ ] Publicar progresso reduzido ao cliente, sem scripts/notas internas. Treinamento/checkpoint são registros; criação de convite externo exige ação própria.

**Aceite:** arquivo incompleto/tipo não qualificado impede anúncio/abertura conforme regra; implantação segue etapas visíveis e auditáveis, com contestação/correção, sem simular execução do projeto na origem.

### HDN-09 — compromissos de SLA, cadência de atualização e notificações reais

**RF:** CIC-02/05/06/07/08, NOT-01/02/03, BUG-01/02/03. **Reuso:** clocks/calendar/priority, external-work, notification/ledger e templates.

- [ ] Reconciliar POP/wiki/proposta de prazos com responsáveis: primeira resposta, solução, pauses, janela de reabertura, business calendar e exceções. Publicar versões e exibir dueAt/asOf, não texto fixo de prazo.
- [ ] Encaminhar bug preserva solução/violação e responsável do atendimento. Cadência de atualização separada; backlog “done” não é correção publicada nem ticket resolvido.
- [ ] Link manual qualificado para desenvolvimento no MVP, resumo público/interno separado e contorno revisado. Criar item remoto só com adapter aprovado.
- [ ] Operar domínio/canal e ledger duráveis; accepted/unknown/delivered distintos, revalidação por destinatário antes do envio e conciliação sem reenvio cego.
- [ ] Lembretes/plantão/autoencerramento ficam desligados até políticas, owners, canal e entrega dos avisos testados. Reabrir não apaga histórico.

**Aceite:** fornecedor real com falhas/ACK perdido/callback repetido, calendário real/feriados, eventos imutáveis; indicador de resposta humana não conta nota/checklist/mensagem automática.

### HDN-10 — pacote documental e encerramento

**RF:** PRJ-05/08 e tabela Backup; geração automática PRJ-06 somente depois. **Reuso:** package-delivery, outbox, ACL e download ledger.

- [ ] Definir conteúdo do pacote, produtor da origem, custo/quota, hashes/objetos e permissões. Não prometer Databook nativo sem implementação.
- [ ] Pedido → aprovação → geração → validação/scan → entrega autorizada → eventual desativação com comando próprio da origem.
- [ ] Prazo comercial de pacote separado de URL temporária; renovação revalida ACL e objetos. Registro de download não recolhe cópia já salva pelo cliente.
- [ ] Obra sem outra ativa/contrato encerrado segue política qualificada; não ampliar acesso a todas as antigas por inferência.

**Aceite:** revogação impede nova emissão; objeto trocado é negado; pacote correto por conta/obra/material; backup de obra não substitui restore do Help Desk. Desativação nunca decorre apenas de entrega confirmada.

### HDN-11 — orientação mínima e conhecimento curado em paralelo

**RF:** BC-01/02/04/06; demais BC conforme fase. **Reuso:** HDW-00/00b, knowledge e macros.

- [ ] Continuar tratamento privado das cinco fontes em quarentena e seleção editorial, sem reproduzir valor suspeito ou interpretar instruções do wiki como comandos.
- [ ] Publicar primeiro orientações necessárias aos formulários do piloto, com fonte/revisão/material/geração/aplicabilidade. Carga das 171 perguntas e 50 limitações não é publicação automática.
- [ ] Macros com prévia/contexto público limitado e envio humano; vídeo embutido somente fornecedor/consentimento/CSP aprovados. Artigo indisponível não bloqueia um pedido legítimo.
- [ ] Medir feedback como ajuda declarada. Não chamá-lo de redução comprovada de chamados sem desenho de medição.

**Aceite:** busca/snippet/preview não cruzam audiência; fontes vencidas/legadas/a confirmar são tratadas, sem scripts/segredos/PII pública. Revisão editorial por pessoa responsável, não autoaprovação JSON.

### HDN-12 — contadores úteis e aprendizado operacional

**RF:** CEN-01/03, BUG-07 e relatório/indicadores mínimos descritos nas tabelas. **Reuso:** portal/report/export/SLA.

- [ ] Fila por equipe/responsável e vencimento em SQL; todos os filtros têm total do universo autorizado, não do buffer carregado.
- [ ] Implantar primeiro contagem de pedidos por família/subcategoria/canal, devolutivas, tempo de atendimento e motivos de fechamento; separar SLA de esforço humano registrado.
- [ ] Dados faltantes aparecem indisponíveis; medir hipótese de volume de cadastros e atualizar referência histórica de obras/contas.
- [ ] Export privado com colunas permitidas, antifórmula e revalidação; XLSX exige implementação/qualificação adicional, não declarar CSV como Excel nativo.

**Aceite:** consultas de referência e A/B/C/two-tenants, escalas medidas, nenhum nome de outro cliente em indicadores, índices criados por medição de consulta real.

### HDN-13 — assistência de acesso e aceite do recorte/MVP

**RF:** ACE-03 e todos os MVP anunciados. **Assistência:** retomar o contrato de `access-assistance` previsto no plano original, sem usá-lo como login alternativo irrestrito. Mailbox verificada permite lead limitado, rate-limit, prazo/uso único e resposta genérica; não revela conta/pessoa/chamado ou recupera credencial por correspondência de e-mail. Verificação de vínculo exige IdP/diretório/procedimento qualificado.

**Liberação:** coorte de pessoa/conta/instância/categoria/canal/recursos com evidências atuais. HDN-05 pode ser aceito como piloto reduzido com nome explícito; MVP completo exige reconciliar cada um dos 52 RF-MVP e tabelas relacionadas.

- [ ] Executar testes de produto/SQL/upgrade/browser/CSP e provedores reais necessários ao recorte.
- [ ] Revisão independente e correções; associar fonte/artefato/fingerprint/deploy e smoke seguro.
- [ ] Treinamento e procedimentos; contenção/restore/capacidade/metas aprovados. Nenhum owner, coorte ou prazo é inventado.
- [ ] Confirmar que feature/capability anunciada corresponde a rota e armazenamento reais, sem fallback dos testes.

**Aceite:** jornada real com negativo fora da coorte, rollback/unknown/revogação/e-mail/arquivo exercitados, aceite humano documentado. Publicação técnica não abre automaticamente o atendimento.

### HDN-14 — eficiência da Fase 2

Após observar o piloto, priorizar pelos dados: visões salvas e sinônimos; autosave/CAS; material no catálogo; duplicidade/seguidores com ACL; subtarefas/tempo gasto; incidentes e ações em massa; editor/analytics editorial; sino GEO e inbound; sugestões internas de IA com avaliação. Cada conjunto vira subplano com dados/rotas/tests/providers e orçamento aprovados; a matriz mantém os 43 itens originais visíveis.

Merge entre chamados, notificações em massa e compartilhamento de visões não ampliam audiência. Um incidente comum pode juntar causas, nunca expor conversas de construtoras diferentes. Importação de planilha não executa macros nem associa pessoas por e-mail.

### HDN-15 — diferenciais, escrita de origem e legado

Para os 12 itens Fase 3 e funcionalidades condicionadas: escrita GEO assistida exige payload qualificado, prévia, confirmação, alçadas, idempotência e auditoria da origem; IA precisa de fontes/ACL/avaliação/custos/off switch; WhatsApp API, Android e captura de tela têm contrato próprio. Geração automática de pacote pertence à origem.

Legado V2 continua separado: V1 aceita, identidade/login/consumidor reais, contratos de mapping e decisão própria sobre histórico. Continuidade de número visual não autoriza importar pessoas/grants, reenviar notificações ou recalcular SLA retroativamente.

## 6. Critérios de execução e de entrega

Cada incremento deve fechar uma capacidade observável no seu nível. Domínio/local → integração técnica → SQL real/upgrade → navegador → fornecedor → deploy → homologação → operacional são estados separados. Uma interface que pede CAS/lock não implementa CAS/lock por si só.

No checkout completo: reconsultar branch e PRs; aplicar uma alternativa de patch; `npm ci`, `npm run check:lock`, `npm run check:migrations`, `npm test`, `npm run typecheck`, `npm run check:contracts`, `npm run check:secrets`, `npm run build`, `npm audit --audit-level=high`; executar runners originais PostgreSQL/UI e homologação canônica da fonte exata. Validar os comandos no package atual antes do uso, sem inventar um `check:all`.

Não editar logs/contagens/gates para aprovar. Preservar execuções vermelhas e corrigir causas. Entregar a cada rodada ZIP cumulativo desde a base integrada atual + handoff + manifestação de mudanças + evidências. Patches de bases diferentes são alternativas, nunca sequência. Quando houver merge remoto novo, revisar a base e não copiar arquivos antigos sobre ele.

## 7. Estado nesta rodada e primeiro próximo passo

**Entregue localmente:** comparativo integral; plano V2; matriz de 107 RF; validação e guarda de checklist de resolução no workflow real; quatro templates de referência como drafts; testes locais de domínio/composição com transporte controlado. HDW-00/00b é herdada da base integrada do PR27; seus arquivos locais antigos não acompanham o patch.

**Não entregue:** UI/marcação, store SQL/locks/CAS novos, migration, publicação de templates, runtime novo, IdP/API qualificados, fornecedor/produção/CI atual. A documentação não fecha esses itens por declaração.

**Próximo desenvolvimento de código:** HDN-01b no checkout completo, juntamente com o adaptador mínimo de workflow necessário ao Cadastro de usuário. Completar escrita autenticada do checklist, snapshot/revisões e SQL real; depois UI interna e prova HTTP. Em paralelo, obter contratos de identidade/contexto de HDN-02. Não criar outro motor de curadoria ou novos módulos opcionais em substituição a esses bloqueios.
