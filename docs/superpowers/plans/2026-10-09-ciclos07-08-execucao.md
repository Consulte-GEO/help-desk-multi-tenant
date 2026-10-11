# Ciclos 07 e 08 — execução sobre C05/C06 local

> Executor: superpowers:executing-plans. User autorizou a sequência do plano de18ciclos; não significa aprovação de produção.

**Goal:** implementar formulários versionados e motores de workflow/SLA com contratos explícitos, preservando autorizações, histórico e código anterior.
**Architecture:** regras de formulário partilhadas JS (navegador/servidor), aplicação de publicação com transação/autorização existentes, motor de workflow puro com comando auditável e projeção de SLA por intervalos UTC exatos. Interfaces PostgreSQL não são substituídas por modelos em memória no runtime.
**Stack:** Node22/TypeScript, HTML/CSS/JS; sem nova dependência de produto.
**Spec:** plano original CG06, CG08/09; plano18ciclosC07/C08. A spec complementar e taxonomia9categorias não foram recuperadas. Nada delas é presumido.

## Condições preservadas
- 122arquivos da entradaC05/C06; PR26 headf60baed, código posterior somente local.
-12migrations e schema0.19.0, scopes de Thiago, configuração/Auth e gates não alterados.
- JSON é DSL limitada; sem eval, regex/URL/path do usuário. Labels não autorizam lookup/download. Arquivo sem recibo clean não satisfaz envio.
- Dados e versões publicados não são reescritos; reverter cria nova versão. Nenhuma categoria real, prazo comercial, feriado ou SLA é semeado como aprovado.
- Calendário publicado contém intervalos UTC e horizonte explícito; vazio dentro do horizonte significa não útil; fora dele é erro/indisponível, nunca0.
- Fonte e SQL reais, migração/upgrade, UI/runtime/build completo e revisão independente são gates próprios, ainda pendentes.

## Revisão e decisões
1. Recibo estrutural não é autenticação: consumidor de formulário deve usar lease real e revalidar evidências na transação final.
2. Condicionais só referem campos escalares anteriores e incondicionais do mesmo nível: ciclos e conteúdo oculto enviados são recusados.
3. Repeater de um nível (sem aninhamento), no máximo100linhas, schema100campos, respostas2000células, JSON256KiB: limites técnicos, não de plano comercial.
4. Datas civis e decimais são strings canônicas; não conversão silenciosa numérica de IDs/CNPJ ou float de valores exatos.
5. Scheduler fornece planos de aviso apenas; autocancel/autoencerramento não são implementados nem habilitados.

## Tarefas
### T1 — CNPJ e DSL compartilhada (C07/CG06b)
Files: shared/{cnpj,form-rules}.js e declarations; tests/{cnpj,form-rules}.test.ts.
- [x] RED local observado: DV inválido; campos extras/JS/getters/arrays/condições inválidas; tipos sem handler; conteúdo em campo oculto.
- [x] Implementado parseFormVersion/validateFormValues/parseTablePaste; tipos text/textarea/boolean/integer/decimal/date/cnpj/select/multiselect/repeater/table_paste/lookup/file/info/download.
- [x] GREEN local: precisão decimal, data bissexta, erros por path, campos públicos distintos, requisitos de evidência sem conceder acesso.

### T2 — Validação de evidências e catálogo versionado (C07/CG06a)
Files: src/domain/{form-schema,form-validation}.ts; src/application/form-catalog.ts; tests/form-catalog.test.ts.
- [x] Validação local sob lease real; ports server-side verificam lookup/recibo por pessoa/conta/refs/campo/formVersion/draftRevision. Nunca uma flag do browser.
- [x] Operações locais salvar rascunho/publicar/restaurar com CAS, capability, audit/receipt; publicação falha sem todos os handlers e políticas das categorias.
- [x] GREEN local: replay histórico, publicação imutável, reversão por nova versão, expiry antes do COMMIT, falhas atomicidade (modelo de teste declarado).

### T3 — Renderização/editor (C07/CG06c)
Files: web/{dynamic-form,admin-forms}.js e CSS; tests/{dynamic-form,admin-forms,form-catalog-http,forms-build}.test.ts; browser pendente.
- [x] Render local seguro sem innerHTML, inputs acessíveis, tabelas TSV atômicas, visibilidade limpa, snapshot sem campo oculto, saída/edição apaga referências.
- [x] Editor local rascunho+prévia+diff, sem publicação automática; dados de edição imutáveis após solicitação desconhecida.
- [x] Testes de estado/DOM com double executados; não equivalem ao navegador real.
- [ ] Navegador, acessibilidade manual e integração no runtime pendentes, sem contornar bloqueios de ambiente.

### T4 — Workflow compatível (C08/CG08a/b)
Files: src/domain/support-workflow.ts; application/support-workflow.ts; testes.
- [x] RED local resolução sem texto, integração como humano, versão/perfil divergentes, aprovação pendente, terceiro fecha solução, reabertura fora de janela.
- [x] Preservados estadoscore e responsável, eventos públicos mínimos, histórico versionado, fluxo customer-return separado de nota/arquivo.
- [x] Composição de mutação atômica condicionada a escopo e If-Match, audit/event/outbox, replay com ACL atual. Sem montar automaticamente o endpoint legado.

### T5 — Calendário/relógios/prioridade (C08/CG09a/b/c)
Files: src/domain/{business-calendar,sla-clock}.ts; testes. Ruling: prioridade e proposta de aviso são funções pequenas de sla-clock.ts; scheduler distribuído não implementado.
- [x] RED local observado: sexta17:30+600min→segunda17:30, feriados, micros, overlap/horizonte, evento fora de ordem, máquina/assignment não humano.
- [x] Motor local por intervalos de calendário e segmentos de estado, clocks separados, pausa segundo policy, violação não apaga ao resolver/reabrir. Sem scheduler que scan minuto a minuto.
- [x] Planos locais de aviso idempotentes (somente proposta); automações destrutivas sempre indisponíveis. Policy/category precisam de publicação qualificada.

### T6 — Verificação e entrega
- [x] Reexecutar baseline possível+novos testes, types/syntax; mutações negativas e autorrevisão. Resultado1096/1096 no recorte; ver evidências.
- [x] ZIP cumulativo com3patches alternativos e manifest/hash; aplicação/reversão/reaplicação conferidas. Fontes antigas preservadas; logs não sãoCI.
- [x] Handoff entregue com interfaces e comandos para stores/PostgreSQL/readiness/OpenAPI/runtime/build/browser/CI.
- [ ] Executar esses gates integrais antes de merge; nenhum grant/live provider inventado.

## Resultado da execução
Componentes locais concluídos com RED/GREEN e revisão; ver docs/operations/CICLOS07-08-2026-10-09.md. A publicação do perfil, adaptadores duráveis, compilador de calendário civil, scheduler distribuído e todos os gatesSQL/UI/runtime permanecem pendentes. [x] local não representa aprovação operacional.
