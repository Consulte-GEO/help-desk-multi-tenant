# Help Desk — estado corrente

Atualizado em **16/10/2026**. Esta página resume os checkpoints e seus limites; os documentos datados continuam preservados como histórico. Código, teste local, CI, publicação e aceite humano são estados distintos.

## Produção confirmada

| Referência | Estado |
|---|---|
| Site | `https://helpdesk.consultegeo.org`, atendimento Consulte GEO ativo |
| Branch de produção | `codex/m1-reproducibilidade` |
| Último PR publicado | [#68 — busca na conversa pública carregada](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/68) |
| Merge publicado | `c6d398fac03efd2439923c39dce47307b73e0bb7` |
| Deploy Netlify | `6ad29a17a2836c92c65ed8a2`, READY em16/10/2026 às18h45 Brasília |
| Verificação desta publicação | 121/121 entradas do manifesto por HTTPS/hash; controles privados e capacidades; quatro recusas anônimas401 conformes. Nenhuma operação de negócio ou migration. |
| Qualificação da implementação do PR68 | Fonte `9ab8b704f3788fe238e0b868039e0ad836bc12cc`; CI7.273 verificações, revisão encerrada. [Escopo e recibos](implementation/BUSCA-CONVERSA-2026-10-16.md). |
| Contratos atuais | API/interface0.31.0; core/schema0.27,21 migrations. Addons privados Apoio/Wiki não são migrations extras do core. O catálogo de banco não foi reexecutado nesta publicação sem SQL. |

Provas desta publicação: `evidence/message-search-20261016/production/publication.json` e `response-contract.json`. Os resultados anônimos não comprovam uso autenticado humano ou sucesso de um comando autorizado.

## Entregas e continuidade

**HD-019 — busca local na conversa pública:** [PR68](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/68), fonte `9ab8b70` revisada e aprovada no CI integral (7.273 verificações), mesclada e publicada no deploy indicado acima. [Preview da implementação conferido](https://deploy-preview-68--helpdesk-consultegeo.netlify.app). Pesquisa apenas o texto das mensagens públicas carregadas do chamado aberto, reaproveitando sua leitura autorizada. Navegação entre resultados, cobertura explícita e limpeza por contexto; não amplia a pesquisa da fila nem inclui notas internas. [Escopo, testes e evolução](implementation/BUSCA-CONVERSA-2026-10-16.md).

**HD-019 — busca na descrição:** implementação em qualificação na branch isolada `codex/busca-descricao-20261016`, ainda sem PR/publicação. [Desenho, plano e limites](implementation/BUSCA-DESCRICAO-2026-10-16.md). Pesquisa global de mensagens exige uma projeção autorizada que também cubra interações públicas do workflow; não usar só a tabela de mensagens.

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
