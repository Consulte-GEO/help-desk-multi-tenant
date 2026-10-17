# Reconciliação local de recuperação — HD-045 — 17/10/2026

## Escopo

Continuidade autorizada após a publicação do PR73. Expor os planejadores C15 já existentes como relatório local somente leitura, sem criar uma segunda política de recuperação. Este recorte prepara a revisão operacional; não conclui o restore operacional HD-045.

Quatro arquivos JSON privados e congelados são obrigatórios: `--delivery-backup`, `--delivery-current`, `--access-restored` e `--access-tombstones`. Informar também `--at` em UTC canônico, com três ou seis casas decimais; não há relógio implícito. Limites: 2 MiB por arquivo, 1.000 elementos por array. Os caminhos devem ser distintos; links físicos/simbólicos e aliases de diretório são recusados pelo leitor local existente. Cópias estáveis não constituem uma transação entre os quatro arquivos.

As entregas usam `DeliveryRecord` de `src/domain/notification-delivery.ts` (C12); referências e tombstones usam o contrato de `planRestoredAccess` em `src/domain/recovery-plan.ts`. Não são exports SQL nem o formato nativo HDN V2/Resend/Apoio. Não criar um adaptador por suposição. O ledger atual e os tombstones devem ser conservados fora do rollback. O operador deve comprovar procedência, cobertura e instante de captura; nomes, hashes e arquivos distintos não demonstram autoridade ou independência das fontes.

## Relatório

JSON fechado com versão, contrato `c15-recovery-v1`, instante normalizado, contagens e hash canônico de cada array, contagens dos nove estados de entrega e das cinco ações de acesso, hashes dos dois planos e flags explícitas: autoridade não verificada, produção não aprovada, restore não executado, workers não liberados, zero mutações e zero entregas liberadas. Não emitir linhas, identificadores, protocolos, endereços, caminhos, URLs, recibos de provedor ou valores de segredos. Hash canônico é `requestHash/canonicalJson` existente: não é hash dos bytes do arquivo, atestado de origem nem uma implementação geral de RFC8785. Ordem dos arrays integra o hash.

Qualquer argumento, arquivo, array ou conflito inválido recusa o relatório inteiro: exit1, stdout vazio, stderr genérico sem dados privados. Exit0 significa somente cálculo concluído, inclusive quando os quatro arrays são vazios. `--help` sozinho explica os limites sem ler arquivos. Importar o módulo não executa o CLI. A saída deve ser redirecionada para um arquivo novo, fora das entradas: o shell abre o destino antes de iniciar o programa.

Reutilizar integralmente as regras existentes: confirmação retida prevalece; pendências nunca autorizam reenvio; tentativas sem confirmação ficam incertas; revogação e apagamento retidos prevalecem, mesmo com revisão antiga; sessões/recibos são invalidados, identidades/vínculos exigem revalidação e objetos ficam em quarentena. Nenhum comando de aplicar, restaurar, enviar ou ativar. Sem rede, banco, escrita de arquivos, alteração de SQL, dependências, UI, grants, segredos ou infraestrutura.

## Pendências preservadas

Ainda dependem de projeto próprio: adaptador auditado do ledger operacional nativo; armazenamento independente comprovado de revogações; aplicação durável com CAS, auditoria e pausa dos workers; ensaio isolado autorizado com RPO/RTO, retenção e aceite humano. MFA/Novo GEO adiados; scanner cancelado; sem invenção de modelos técnicos. MCP separado continua exclusivamente local.

## Qualificação

Registrar RED/GREEN, testes focais, tipos, contratos, lock, segredos/build, revisão independente e CI Linux/PG17 antes de apresentar o novo PR para integração. Não declarar restore, aceite humano ou validação de dados produtivos por testes sintéticos.


Limites adicionais do contrato C15: Também se aplicam os limites cumulativos dos planejadores existentes por array: 262144 bytes contabilizados (chaves/textos/valores; não tamanho JSON), 15.000 nós e profundidade12; podem recusar entradas antes de1.000 linhas/2 MiB. Não há fragmentação automática: revisar o escopo coerente das cópias ou projetar um adaptador próprio, sem perder conflitos ou revogações entre lotes.
