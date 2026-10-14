# UX10 — compatibilidade visual com a operação Consulte GEO

Data de referência: 13/10/2026, America/Sao_Paulo. Sem merge, publicação ou ativação operacional nesta entrega.

## Decisão e escopo

Unir o cumulativo visual UX01–UX09 com os desenvolvimentos M04/M09a/M09b da branch operacional, sem recriar o backend ou sobrescrever suas correções. Priorizar a Consulte GEO e preservar isolamento entre contas, obras e identidades. Não investir em novas abstrações multiempresa nesta fase.

A leitura começou em `1c6aa7ef94ccf1ae41179ae07d09ade2de96329e` e foi reconciliada com `b4a6c9012463d3709e51a9b17efe68997a7b2d7a`. As árvores `web`, `shared` e `scripts` são idênticas nesses dois commits; o segundo altera SQL/testes e o manifesto da migration M09b. O aplicador exige os contratos da revisão mais nova. A base anterior continua em `604478e2d05ed019baac6d92a9a04db236fafb82`.

## Colisões resolvidas

| Arquivo | Diferença relevante | Resultado desta entrega |
|---|---|---|
| `web/dynamic-form.js` | M09a acrescentou `canEdit`, `onChange(answers)` e invalidação de seleções tardias; UX03/04 tinham acessibilidade, booleano explícito e `onAnswersChange` | Preservados os dois contratos de notificação, o bloqueio pelo proprietário, o descarte geracional e a experiência visual |
| `web/dynamic-form.d.ts` | Contrato operacional faltava no tipo visual | Opções combinadas sem remover o callback visual |
| `web/support-intake.js` | UX09 não encaminhava fases ao pai e regredia recusa de conciliação | Pai recebe fases; primeira recusa continua editável; recusa de replay após incerteza mantém a intenção bloqueada |
| `web/support-intake.d.ts` | `IntakeUiOptions & DynamicFormOptions` sobrepunha dois `onChange` incompatíveis | `Omit<DynamicFormOptions,'onChange'>` deixa o callback de estado com seu tipo próprio |
| `web/timeline-state.js` | Operação nova `transfer` | Arquivo operacional preservado, protegido por hash; não é regravado pelo pacote |
| `scripts/build.mjs` | Build UX09 não tinha as seis referências de assets M04/M09 | União de todos os assets; nenhuma montagem/rota é habilitada pelo build |
| `web/index.html` | Duas folhas de estilo novas e identificação fixa da versão antiga | CSS incluído; removidas duas etiquetas fixas 0.27.0, sem inventar versão de API pela interface |

## Desenvolvimento adicional

A jornada `consultegeo-request` agora mantém as classes do host, mostra confirmação de descarte antes do formulário longo e prepara o adaptador local antes de destruir o pedido anterior. Falha de construção do adaptador não apaga o preenchimento anterior. Troca durante salvar/revisar/enviar/resultado incerto continua bloqueada.

O editor `consultegeo-configuration` usa os tokens de cores, superfícies, bordas, foco e tipografia Consulte GEO; apresenta resumo explícito da operação, motivo e versão; mantém confirmação separada de preparação. Cancelar é secundário. Recusa posterior de uma operação incerta não é prova de ausência do primeiro COMMIT: permanece em `unknown`, com mesma intenção, até confirmação ou encerramento do contexto.

O renderer, o painel de solicitação, a jornada e o adaptador real de sessão foram exercitados em composição. A bancada usa transporte e identidade fictícios, não resolve a origem nem prova autorização.

## Invariantes

Nenhum novo endpoint, nenhum envio automático, nenhum acesso por UUID digitado tratado como permissão, nenhum token em armazenamento, nenhuma migração aplicada e nenhuma alteração de configuração operacional. `ADVANCED_ACCESS` continua falso. `shared/consultegeo-request.js`, `web/consultegeo-intake-api.js`, contratos de domínio, auth e controladores de autorização são dependências somente leitura.

A prévia não concede autorização. O servidor revalida revisão, cobertura, identidade e referências. Estado de notificação continua distinto de gravação do chamado. As duas telas nativas continuam opcionais, sem importação de montagem no `app.js`.

## Aceite local e limites

Testes de regressão precisam verificar os dois callbacks, seleções que chegam depois de bloqueio/ocultação, lock do seletor pai, recusa inicial versus replay recusado, preservação do pedido anterior, histórico privado de transferência, resumo de publicação e assets simultâneos. Navegador deve cobrir 320/390/768/1024/1440 px, claro/escuro, mesmos controladores, e caminhos `/v1` sem duplicação.

O pacote não é um checkout completo. Testes da árvore seletiva, build e bancada visual não substituem CI da composição final, PostgreSQL real, HTTP/CSP ou homologação hospedada. As evidências antigas UX01–UX08 continuam históricas quando não reexecutadas.
