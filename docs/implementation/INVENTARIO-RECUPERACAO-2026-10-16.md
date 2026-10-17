# HD-045 — conferência local de arquivos para recuperação

## Desenho do recorte

Ferramenta explícita, local e somente leitura para inventariar os arquivos reais de uma bancada e comparar a cópia com um manifesto anterior. Reutiliza `digestRecoveryRows`, `parseRecoveryInventory` e `compareRecoveryInventory`; não substitui a captura consistente dos dados nem executa restore, SQL, rede, envio, exclusão ou retomada de workers. Desenvolvimento independente a partir da produção PR69; PR70 permanece em revisão separada.

A raiz privada e estável deve conter exatamente seis diretórios: `database`, `objects`, `configuration`, `key_inventory`, `outbox`, `revocations`. O operador prepara os exports autorizados: dump do banco e addons; bytes dos objetos; configuração; referências/gerações de chaves (não seus valores); ledger autoritativo preservado fora do rollback; revogações/exclusões preservadas. A ferramenta não certifica a origem, a completude desses exports ou a semântica de seus registros.

Cada arquivo é lido em blocos e tem tamanho e SHA-256 conferidos. A identidade relativa de arquivos e subdiretórios entra no hash, inclusive diretórios vazios. Datas, raiz absoluta e ordem de criação não entram: uma cópia idêntica em outro caminho deve produzir o mesmo manifesto. A saída contém apenas seis contagens/bytes de metadados e hashes; nenhum nome, caminho privado, conteúdo, destinatário ou segredo é impresso. `inventory.*.count` conta arquivos e subdiretórios, não linhas do banco; `bytes` mede a representação canônica dos metadados, não volume de backup nem RPO/RTO.

Formato fechado: `{schemaVersion:1, algorithm:"helpdesk-file-tree-v1", inventory:{...seis componentes...}}`. `--root <pasta>` produz esse manifesto. `--root <pasta> --expected <manifesto.json>` exige o mesmo formato e produz `{schemaVersion:1, algorithm, inventory, verification:{state,mismatches,productionApproved:false,restorePerformedByThisFunction:false,resumeWorkers:false}}`. Exit0 significa leitura concluída/igualdade,2 divergência,1 inspeção inválida ou incompleta. Igualdade nunca autoriza produção.

Limites totais por execução:10.000 entradas,256MiB de arquivos,12 níveis de subdiretórios e30s; opções internas de teste só podem reduzir limites. Manifesto esperado:256KiB, fora da raiz. Recusar componentes ausentes/extras, links simbólicos/junctions/aliases, hardlinks de arquivos, arquivos especiais, nomes de controle, profundidade excessiva e alterações detectadas durante a inspeção. Verificar identidade/metadados antes/depois e ao encerrar a árvore. Diretório privado, sem escritor concorrente hostil, é pré-condição: APIs de filesystem portáveis não fornecem snapshot transacional nem proteção absoluta contra todas as corridas.

## Critérios de conclusão

- Cópia real de arquivos preserva os seis inventários; alteração de mesmo tamanho, remoção, renomeação e mudança de diretório vazio são detectadas.
- Entradas inválidas, limites, links, expected malformado e cancelamento falham sem saída parcial ou detalhes privados.
- Importar os módulos não executa CLI. Não usa credenciais, variáveis de ambiente de negócio ou conectores.
- Regressões do planejador e despachante continuam comprovando que um inventário igual não libera acessos/envios.
- Focais locais, tipos, contratos, build e CI integral vinculados à fonte; revisão independente; documentação de uso e evidências preservadas.

HD-045 continua parcial: ensaio real PostgreSQL/Storage, captura consistente, aplicador durável, política de retenção, RPO/RTO e responsáveis exigem seus critérios próprios. MFA/Novo GEO/modelos técnicos não são ampliados; scanner continua cancelado.

## Verificação da implementação

Fonte `740237188ecb46ea1af8243156bd135096e96f64`, [PR71](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/71), baseada em `72a72b5`, independente do PR70. Fingerprint `559f6cbe69b96d6d3115133acc2b81de39b4d38c56a450ac1a81a59b58f77bca`.

Local Windows/Node24:76 focais aprovados, zero falha/skip/cancelamento/todo; tipos,45 operações de contrato, build completo, lock e scanner heurístico de segredos aprovados. O scanner heurístico não equivale a auditoria de segurança. A primeira tentativa no sandbox teve35/40 e cinco falhas EPERM na preparação de rename/links; sua repetição válida teve74/74, seguida de76/76 após acrescentar casos de prazo e componente que deixou de ser diretório. O primeiro typecheck apontou narrowing de `object`; foi corrigido para `Record<string,unknown>` após conferir o envelope. Logs iniciais e finais são preservados, sem transformar diagnóstico falho em gate aprovado.

Revisor independente somente leitura, contexto novo: nenhum achado confirmado pendente; repetiu76/76 fora do sandbox e conferiu diff. O cenário FIFO foi aprovado no CI Linux; não foi simulado como aprovado no Windows. Recibo: `evidence/recovery-inventory-20261016/review.json`. CI integral da fonte, merge de teste e prévia aprovados; entrega pronta para revisão, sem merge/publicação.


## Qualificação integral da fonte

[CI de origem38994228615](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38994228615): Node22/Linux,5.956 testes de aplicação,703 em PostgreSQL17 com login restrito e673 de interface, total7.332, zero falha/skip/cancelamento/todo. Gates independentes lock/install/audit também aprovados. HDA e Apoio Implantação aprovados nas execuções de origem e PR.

Artefato original `helpdesk-homologation-740237188ecb46ea1af8243156bd135096e96f64-38994228615-1`, digest informado pelo GitHub `sha256:201e61fc3e18b08b39509b86c0ff57185edb06a6064a638648e351de5d55b884`. Relatório e seis logs copiados sem normalizar os bytes para `evidence/homologation/runs/0559aaa2-5c01-4cdb-880f-97c478af2369/`; latest.json corresponde à fonte exata e todos os hashes/fingerprint foram conferidos. Recibo: `evidence/recovery-inventory-20261016/ci-qualified.json`. [Merge de teste38994234147](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38994234147) também aprovado.

Prévia inicial `6ad2da5857bf69a6c0a8de41`, fonte7402371, teve erro de build e não foi aceita; o relatório desta fonte ainda não estava registrado na árvore. O estado do provedor foi preservado, sem inferir prova de publicação. A próxima prévia deve passar pelo gate com o relatório qualificado. Nenhuma dessas execuções é restore produtivo ou aceite humano operacional.


## Prévia e entrega para revisão

[Prévia71](https://deploy-preview-71--helpdesk-consultegeo.netlify.app), deploy `6ad2dcebfb4c99b9e1836209`, READY, head `b8d957ac6a1bb202ede709ad61d2e6d39103181b`. Nove assets críticos conferidos por bytes ou SHA-1 do manifesto, incluindo shell/HTML (somente inserção CDP identificada do provedor), estado da fila e entrada/facade do Apoio. Recibo `evidence/recovery-inventory-20261016/preview.json`. A CLI é uma ferramenta local do repositório, sem nova tela ou API; a prévia qualifica o pacote web existente.

A produção continua no PR69/merge72a72b5, deploy6ad2c3fd7dd44b857679b79f. PR70 permanece separado e aberto; PR71 não inclui seu código. PR71 pronto para revisão, sem merge, migração, envio de negócio ou implantação produtiva nesta rodada. O último commit de documentação/evidências preserva o fingerprint da fonte qualificada; seus checks e sua prévia devem ser reconferidos antes de qualquer integração.


## Integração com PR70 — 17/10/2026

**17/10/2026 — integração autorizada:** PR70 mesclado em941dc579912e84cb80a70d0c3a37f7a68c3852b2; publicação em conferência. PR71 atualizado com essa base, preservando código e recibos dos dois recortes; a combinação exige novo relatório integral antes de seu merge. Os checkpoints anteriores descrevem suas fontes originais.

Conflitos limitados a documentação e ponteiro latest.json, resolvidos preservando os checkpoints do PR71 e importando os arquivos/evidências do PR70. Nenhum conflito de código. O latest anterior permanece histórico e não qualifica a combinação: será substituído somente pelo artefato original do novo CI.

PR70 publicado e conferido conforme recibos acima; os80 focais da combinação com PR71 passaram. Relatório integral combinado ainda requerido antes do merge do PR71.
