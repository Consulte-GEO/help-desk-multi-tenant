# Recuperação do Help Desk — runbook candidato C15

**Não executado em produção. Não autoriza restauração, exclusão, rotação ou reenvio.** Fonte vinculante: CG18 do plano de implantação. O produtor de um Databook não substitui o backup/restore do Help Desk.

## Manifesto de recuperação

### Conferir os arquivos de uma bancada privada

`npm run recovery:inventory -- --help` descreve o utilitário local. Prepare uma pasta estável, fora da árvore do projeto e sem escritores concorrentes, contendo exatamente os diretórios `database`, `objects`, `configuration`, `key_inventory`, `outbox` e `revocations`. Coloque os exports autorizados e os bytes dos objetos em seus componentes. Em `key_inventory`, mantenha referências/gerações, sem valores de chaves. Outbox e revogações precisam refletir os controles autoritativos preservados fora do rollback; sua procedência é responsabilidade do procedimento de captura. Diretórios vazios são aceitos, mas não comprovam que a origem não tinha dados.

```powershell
# Exemplos com caminhos locais da bancada; não apontar para produção.
# stdout de npm contém seu banner: use node diretamente para salvar JSON puro.
node --experimental-strip-types scripts/recovery-inventory.ts --root C:/bancada/original > C:/bancada/manifesto.json
node --experimental-strip-types scripts/recovery-inventory.ts --root C:/bancada/copia --expected C:/bancada/manifesto.json
```

Guarde o manifesto **fora** das duas raízes e compare somente manifestos capturados por esse mesmo formato. Não redirecione a saída para dentro dos componentes: o shell abre o arquivo antes de iniciar o programa. A ferramenta não grava arquivos. Exit0 significa inventário concluído ou comparação igual;2 significa divergência;1 significa inspeção não concluída. Trate erro ou execução interrompida como ausência de evidência e não use saída parcial como manifesto. No PowerShell, salve e confira `$LASTEXITCODE`; no bash, `$?`. PowerShell5.1 pode gravar redirecionamentos em UTF-16: salve stdout explicitamente como UTF-8 quando necessário; o leitor aceita somente JSON UTF-8.

Os hashes incluem os bytes e a identidade relativa de cada arquivo e diretório vazio; independem do caminho absoluto e das datas. A saída não contém nomes privados ou conteúdo. `count` conta arquivos/subdiretórios; `bytes` conta metadados canônicos usados no digest, não tamanho de backup. Links, junctions/aliases, hardlinks de arquivos, arquivos especiais, componentes extras/ausentes e alterações detectadas bloqueiam a inspeção. Limites globais:10.000 entradas,256MiB de arquivos,12 níveis e30s. Não é um scanner e não estabelece segurança dos objetos. Use cópias locais estáveis; o filesystem não fornece snapshot transacional contra escritor hostil.

Esse recorte comprova comparação de arquivos reais locais. Não executa `pg_restore`, não exporta dados automaticamente, não valida a completude/procedência dos exports, não aplica reconciliação nem liga workers. Mesmos hashes não significam que permissões, ledger, revogações ou RPO/RTO foram aceitos. [Desenho e evidências](../implementation/INVENTARIO-RECUPERACAO-2026-10-16.md).

Registrar separadamente inventários e referências de versão para seis componentes: banco; objetos; configuração; inventário de referências/gerações de chaves; outbox/ledger; revogações e exclusões. O módulo `digestRecoveryRows` lê streams completos, ordenados por chave opaca em UTF-8 binário, com limite de linhas/bytes/prazo. Produz somente contagem, bytes e hash; não inclui registros nos logs. O adapter deve usar snapshot consistente e chaves estáveis. O inventário de chaves contém **referências**, não segredos em texto.

`compareRecoveryInventory` exige os seis componentes. Um match é evidência de integridade do inventário recebido, não prova de que a origem foi corretamente capturada, restaurada ou aceita. Banco com totais iguais não aprova objetos ausentes ou configuração diferente.

A documentação oficial do Supabase informa que o backup de banco não inclui os objetos mantidos pela API Storage, apenas metadados. Portanto, o procedimento deve comprovar sua recuperação separadamente. Também observar recuperação das senhas de papéis personalizados pelo mecanismo autorizado, sem colocá-las no manifesto.
Fonte técnica: [Database backups](https://supabase.com/docs/guides/platform/backups). A consulta ao changelog Markdown não completou pelo leitor; nenhuma atualização de biblioteca foi inferida ou feita.

## Sequência antes de um ensaio real

1. Obter autorização explícita, dono do ensaio, janela, destino isolado permitido e critérios de contenção. Confirmar que o destino não é a produção; não criar ambiente cloud pago sem escolha/custo aprovado.
2. Confirmar fonte, migrations, esquema, configuração e ferramentas reais. Executar os testes SQL pendentes em banco descartável antes de extrapolar o comportamento. Manter a produção e os providers fora do ensaio.
3. Preservar fora do rollback o ledger autoritativo de entregas, registro de revogações/exclusões e **geração de recuperação**. Não considerar uma cópia antiga desses três controles como autoridade atual.
4. Antes de restaurar, bloquear ingressos de negócio e dispatch nos controles autorizados. Os dados já recebidos/enviados são efeitos reais: não anunciar que voltar o código os desfaz.
5. Restaurar a cópia no destino aprovado; medir tempos e capturar inventários completos. Sem leitura arbitrária de arquivos do servidor por SQL. Usar ferramentas oficialmente suportadas no fluxo aprovado.
6. Reconciliar ledger e tombstones. Validar as permissões atuais; não reativar sessões antigas. Objetos restaurados ficam em quarentena até nova prova de integridade/scan/ACL.
7. Trocar a geração de recuperação no controle retido e reconciliá-la com o root local. Não reutilizar a prova de release anterior. Validar todos os helpers de autorização e o comportamento das rotas.
8. Comprovar contagens/hashes, replay, concorrência, idempotência, tempos/RPO/RTO e políticas. Revisão independente e aceite antes de nova preparação do piloto. Não religar workers por um match de inventário.

## Notificações restauradas

O planejador `planDeliveryRecovery` preserva intenção, destinatário, payload hash e recibo confirmado mais recente. Aceita permanece aceita, não entregue. Entregue não vira pendente. Uma linha antiga pending/retry/leased sem tentativa é suprimida para revisão; com possível tentativa vira unknown. Nada é automaticamente despachável. Ausência de prova atual não autoriza reenvio. Recibo incompatível, mesma revisão divergente ou chave duplicada bloqueiam a conciliação inteira.

O plano é puro: precisa de um aplicador durável, autorizado, com compare-and-swap, registro de auditoria e bloqueio da fila. O teste desta entrega usa filesystem local e o despachante C12 real sobre um armazenamento controlado. Não é pg_restore, armazenamento de nuvem nem envio real.

## Sessões, direitos e dados excluídos

Tombstone erase produz `do_not_restore`; revoke produz `keep_revoked`, mesmo se um backup posterior inconsistente contiver o registro. Sessões e recibos de download são invalidados; pessoas/bindings exigem revalidação; objetos são colocados em quarentena. Não é feita exclusão física por esse módulo. O registro de retenção/exclusão precisa ser completo e autoritativo. Não há procedimento LGPD ou retenção aprovado apenas por existir este plano.

## Limites ainda não aceitos

RPO, RTO, retenção, periodicidade, destino, responsáveis e custo não foram aprovados. Não há restauração real executada nesta rodada, backup completo de produção inspecionado ou cron ativado. O ensaio deve deixar registros verificáveis, não checkboxes declarados como verdadeiros.
