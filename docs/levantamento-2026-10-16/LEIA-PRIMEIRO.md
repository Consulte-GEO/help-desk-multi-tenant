# O que ainda falta no Help Desk

Levantamento atualizado em **16/10/2026**, código Help Desk **f13754e** e Wiki **72f4e60**. Confronta código, Wiki, decisões,14 chats locais e esta conversa. É um inventário de trabalho, sem alterar aplicação ou produção.

O núcleo de chamados já opera: login, catálogo, rascunho, abertura atômica, oito inclusões cadastrais, cinco ações de usuário, conversa/notas/timeline, fila, workflow/checklist e e-mail transacional. Monitor V2, Wiki v1.7, armazenamento/worker HDA manual e Apoio Implantação integrado já foram entregues. As frentes abaixo descrevem o que falta completar, compor ou aceitar, sem iniciar tudo novamente.

## Leitura rápida do saldo

**50 itens reconciliados:**49HD anteriores +MEL-09 aprovada. Classificação principal, com sobreposições de natureza explicadas em cada item:

| Classe predominante | Itens |
|---|---:|
| Desenvolvimento ou composição | 31 |
| Aceite / qualificação residual | 9 |
| Decisão / política / documentação | 3 |
| Adiado / fase futura | 6 |
| Entregue no recorte original | 1 |

Não é uma estimativa de percentual concluído, esforço ou prazo. Um item de aceite pode exigir integração residual e um item de desenvolvimento pode depender de decisão. Dos itens de engenharia, HD-042/043 são condicionais a MFA/Novo GEO; não entram automaticamente na fila imediata. HD-038 está entregue no recorte original. HD-001 é manutenção documental residual, não funcionalidade inexistente.32AUX e107RF são vistas do mesmo escopo; **não somar50+32+107**.

## Frentes ainda necessárias

1. **Cadastros e coleta:** validação semântica, alçada de acesso, modelos completos de traço/usina/laboratório/fornecedor/bloco/cerâmica/cabos, alteração e vínculo não humano, triagem de problema e pedidos de configuração (HD-011–018).
2. **SLA operacional:** política/recibo coerentes, projeção corrente por transição, prazos/pausas/violação na UI e lembretes/escalonamento aprovados (HD-010/020/021). Motor e clocks iniciais já existem.
3. **Gestão do atendimento:** totais completos, busca por protocolo CG, cockpit/visões, exportação durável, métricas com definição e CSAT (HD-019/026–029). Serviços candidatos devem ser reaproveitados.
4. **Administração:** backoffice durável de equipe/convites/contas/obras/contratos/cobertura e autoridade institucional (HD-009/022/023). Liberação sensível aguarda MFA.
5. **Arquivos e operação:** anexos gerais privados com política compatível com cancelamento do scanner, retenção/purge, restore integral, capacidade/SLO, responsáveis e resposta a incidentes (HD-024/025/045/046).
6. **Implantação:** vínculo idempotente processo↔chamado CG (IMP-03), jornada cliente/nova obra/ajuste e checklist integrado; pacote backup/encerramento depende de contrato de origem (HD-034–036). Importador/PDF/wizard/revisão/e-mail internos já existem.
7. **Conhecimento:** pacote pequeno aprovado para clientes, store/montagem de ajuda/macros no atendimento e **MEL-09**, para localizar orientações depois corrigidas (HD-031/032). Wiki interna já pronta não equivale a liberar conteúdo cliente.
8. **HDA:** intake+tarefa atômicos, painel/histórico/diff/edição, Dev Agent isolado, aprovação exata e executor/reconciliação futuros (HD-039–044). Persistência/worker manual já ativos; efeitos GEO continuam adiados.

## Sequência recomendada para planejar

| Ordem | Resultado esperado | Itens |
|---|---|---|
|1 | Fechar aceites do que já foi publicado e fixar políticas/autoridades | AC-EMAIL/APOIO/WIKI/ONDA2; HD-009/010 |
|2 | Melhorar coleta e ligar implantação ao atendimento | HD-011–017/034/035; política HD-024 quando houver upload público |
|3 | Entregar SLA corrente, consulta completa e operação confiável | HD-020/026/019/025/045/046 |
|4 | Ampliar gestão e conhecimento com reuso | HD-027–029/031/032 +MEL-09; HD-022/023 com liberação MFA legítima |
|5 | Retomar dependências externas somente por decisão | MFA, Novo GEO/SSO, HDA execução, legadoV2; AUX e13MEL conforme aprovação |

Prioridade proposta, sem cronograma. Não esperar todas as dependências externas para evoluir formulários/consulta/operação independentes. Esta documentação não dá aprovação de implantação a cada proposta histórica.

## Documentação para executar e revisar

- [Backlog detalhado e critério de conclusão por item](BACKLOG-ATUALIZADO.md) — principal lista de trabalho; [CSV](BACKLOG.csv) e [JSON](BACKLOG.json) para importar.
- [Aceites pendentes, separados do desenvolvimento](ACEITES-PENDENTES.md).
- [32 complementos AUX](COMPLEMENTOS-AUX.md), [107RF](RASTREABILIDADE-107-RF.md) e [13 melhorias aguardando decisão +MEL-09](MELHORIAS-PARA-DECISAO.md).
- Análises técnicas: [core](AUDITORIA-CORE.md), [Wiki/HDA](AUDITORIA-WIKI.md), [implantação/arquivos/operação](AUDITORIA-OPERACAO.md).
- [Contexto e instruções para o próximo desenvolvedor/Claude](HANDOFF-DESENVOLVIMENTO.md).
- [Fontes, decisões e limites](FONTES-E-DECISOES.md).

Scanner cancelado; MFA, origem Novo GEO e revisão factual adiada preservados. Mobile/filtros e percursos produtivos não verificados por falha do controle do navegador continuam **pendentes**, sem evidência de bug por esse motivo. Não foi executada nova suíte de testes: este trabalho altera apenas documentação, e os limites das evidências anteriores estão expressos.

