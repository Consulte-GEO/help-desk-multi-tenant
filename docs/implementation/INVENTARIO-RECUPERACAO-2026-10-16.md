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
