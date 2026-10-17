# Help Desk — estado corrente

Atualizado em **17/10/2026**. Esta página resume os checkpoints e seus limites; os documentos datados continuam preservados como histórico. Código, teste local, CI, publicação e aceite humano são estados distintos.

**Checkpoint histórico da integração17/10:** PR70 mesclado em941dc579912e84cb80a70d0c3a37f7a68c3852b2; publicação em conferência. PR71 atualizado com essa base, preservando código e recibos dos dois recortes; a combinação exige novo relatório integral antes de seu merge. Os checkpoints anteriores descrevem suas fontes originais.

**Continuidade17/10:** PR73 mesclado/publicado/verificado. Os checkpoints de integração anteriores são históricos. Relatório local de reconciliação HD-045 no PR74 qualificado para revisão, separado e sem merge/publicação.

## Produção confirmada

| Referência | Estado |
|---|---|
| Site | `https://helpdesk.consultegeo.org`, atendimento Consulte GEO ativo |
| Branch de produção | `codex/m1-reproducibilidade` |
| Último PR publicado | [#73 — ordem de criação](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/73), incluindo os recortes anteriores |
| Merge publicado | `d8f1fe28f735eebe28875af46b533b50328f6653` |
| Deploy Netlify | `6ad37227af6d1784b1404bad`, READY em17/10/2026 às10h04 Brasília |
| Verificação desta publicação | 122/122 entradas do manifesto por HTTPS/hash; controles privados e capacidades; quatro recusas anônimas401 conformes. Nenhuma operação de negócio ou migration. |
| Qualificação PR73 | Fonte `df665c089423ee905c2c85feda58ab7cb1526e9e`, CI7.385, revisão independente, fonte/merge de teste e preview aprovados. [Recibos e limites](implementation/ORDEM-CRIACAO-2026-10-17.md). |
| Qualificação anterior PR70/71 | Fonte `a26ccb2fac5405b3f1fa1111223bc9cc6353a501`, CI7.346, revisão original dos recortes e merge de teste aprovados. [Recibos e limites](implementation/INVENTARIO-RECUPERACAO-2026-10-16.md). |
| Contratos atuais | API/interface0.31.0; core/schema0.27,21 migrations. Addons privados Apoio/Wiki não são migrations extras do core. O catálogo de banco não foi reexecutado nesta publicação sem SQL. |

Provas desta publicação: `evidence/publication-pr73-20261017/publication.json` e `response-contract.json`. Os resultados anônimos não comprovam uso autenticado humano ou sucesso de um comando autorizado.

## Entregas e continuidade

**HD-019 — período de criação:** [PR72](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/72) mesclado e publicado no deploy acima. Fonte95f7f2f, CI integral7370 e revisão independente aprovados; janela inclusiva/exclusiva antes da paginação/totais, mesmas permissões e controles em Brasília.122 entradas do manifesto HTTPS/hash, quatro recusas nativas401 conformes e duas consultas anônimas com período recusadas401. Sem migração nem escrita de negócio de teste. [Escopo e recibos](implementation/PERIODO-CRIACAO-2026-10-17.md).

**HD-019 — ordem de criação:** [PR73](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/73), fonte df665c0. CI integral da fonte e do merge de teste aprovados: 5.985 aplicação + 709 PostgreSQL17 restrito + 691 interface = **7.385**, sem falha/skip/cancelamento/todo. Revisão independente sem achados e preview em10 ativos críticos conferido. Mais antigos primeiro usa criação/id ascendentes; padrão/newest mantém ordem e cursores anteriores, mesmos filtros/permissões/totais. Mesclado/publicado emd8f1fe2/deploy6ad37227af6d1784b1404bad;122 entradas HTTPS/hash e recusas nativas401 conferidas, sem migração. [Desenho e evidências](implementation/ORDEM-CRIACAO-2026-10-17.md).

**HD-019 — busca local na conversa pública:** [PR68](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/68), fonte `9ab8b70` revisada e aprovada no CI integral (7.273 verificações), mesclada e publicada no deploy indicado acima. [Preview da implementação conferido](https://deploy-preview-68--helpdesk-consultegeo.netlify.app). Pesquisa apenas o texto das mensagens públicas carregadas do chamado aberto, reaproveitando sua leitura autorizada. Navegação entre resultados, cobertura explícita e limpeza por contexto; não amplia a pesquisa da fila nem inclui notas internas. [Escopo, testes e evolução](implementation/BUSCA-CONVERSA-2026-10-16.md).

**HD-019 — busca na descrição:** [PR69](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/69), fonte `06ef6be` qualificada no CI integral (7.289 verificações) e revisão independente sem bloqueadores. Mesclado e publicado no deploy indicado acima; os recibos produtivos estão no checkpoint. [Desenho, plano e limites](implementation/BUSCA-DESCRICAO-2026-10-16.md). Pesquisa global de mensagens exige uma projeção autorizada que também cubra interações públicas do workflow; não usar só a tabela de mensagens.

**HD-019 — situação interna da equipe:** [PR70](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/70) mesclado/publicado em17/10, fonte original d638cd0 qualificada em7.303 verificações. Também incluído na combinação PR71/7.346 acima. Filtro privado permanece exclusivo de operadores nas contas autorizadas. [Escopo e publicação](implementation/FILTRO-SITUACAO-INTERNA-2026-10-16.md).

**HD-045 — inventário local de arquivos:** [PR71](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/71) mesclado/publicado no deploy acima após qualificação combinada7.346. CLI local somente leitura, comparação de bytes/estrutura de seis componentes. Não executa restore, SQL, envio nem retomada de workers; HD045 continua parcial. [Desenho e recibos](implementation/INVENTARIO-RECUPERACAO-2026-10-16.md).

**HD-045 — relatório local de reconciliação:** [PR74](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/74), fonte6a1d3de, CI fonte/merge 7.421,107 focais e revisão independente com limite herdado corrigido. Preview qualificado em10 ativos críticos. Agrega somente hashes/contagens dos planejadores C12/C15 existentes; não adapta exports nativos, atesta autoridade, executa restore ou libera workers. Sem merge/publicação deste recorte. [Escopo, evidências e etapas restantes](implementation/RECONCILIACAO-RECUPERACAO-2026-10-17.md).

**HD-001 — síntese canônica:** README, AGENTS, plano e estado apontam para esta página. Os snapshots antigos não devem ser usados isoladamente como descrição do produto corrente. O levantamento original continua preservado, sem alteração retroativa de suas contagens ou evidências.

## Capacidades e limites operacionais

- Chamados: abertura, conversa pública, notas internas separadas, responsabilidade, prioridade, workflow e checklist publicados. Protocolo CG, totais autorizados completos, consultas rápidas e resumo do atendimento já publicados; ver [prioridades](implementation/PRIORIDADES-2026-10-16.md). HD-019/026 continuam parciais.
- E-mails: monitor V2 e coleta nativa de abertura/clique já publicados. Cobertura de tracking começa no instante registrado, sem fabricar histórico. [Produção](implementation/EMAIL-MONITOR-V2-PRODUCTION-2026-10-15.md) e [aceite autenticado observado](implementation/EMAIL-MONITOR-V2-ACEITE-AUTENTICADO-2026-10-16.md). Não confundir testes sintéticos complementares com aceite produtivo integral.
- Apoio Implantação: interface, persistência, revisão e fila de e-mails publicados. Aceite produtivo completo e associação autoritativa processo→chamado seguem próprios; [checkpoint](apoio-implantacao-fluxos-ui-2026-10-16.md).
- Administração sensível/MFA ampliada e Novo GEO continuam **adiados**; scanner **cancelado**. Modelos técnicos homologados de materiais não existem. Não criar regras, integrações, alçadas, registros fictícios ou status de segurança para preencher essas lacunas.
- O conector MCP é um projeto independente preparado localmente por decisão do usuário; não está publicado ou conectado ao Claude. Não instalar sua migration no projeto operacional do Help Desk.

## Continuidade sem alterar as decisões vigentes

Busca global no servidor exige audiência e filtros próprios; busca local não a entrega. Validação semântica de campos existentes precisa de nova versão e paridade DSL/publicador/SQL/UI. A projeção corrente de SLA depende de reconciliar política, calendário, pausas e eventos, sem apresentar um prazo antigo como atual. Backoffice administrativo, expansão de audiência e anexos gerais dependem das decisões de autoridade/segurança e não ficam liberados por esta página.

Para um novo ciclo: reinspecionar branch, PR, checks e deploy; ler o checkpoint do recorte; manter snapshots, scopes, idempotência e separação de notas; registrar resultados da fonte exata e limites reais. O levantamento de16/10 é inventário histórico, não prova de que implementações posteriores estejam ausentes.
