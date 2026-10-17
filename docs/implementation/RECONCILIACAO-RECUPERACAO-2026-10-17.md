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


Exemplo executável de saída: [relatório sintético](../../evidence/recovery-reconcile-20261017/synthetic-example.json), gerado pelo CLI real com confirmação atual de entrega, revogação retida e objeto em quarentena. São fixtures locais; não são dados, e-mails, prova de ledger nativo ou restauração produtiva.

## Qualificação da fonte do PR74

Fonte **6a1d3de4558041a4b29cc1ef7949c96e0311d253**; CI [fonte 39035894346](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39035894346) e [merge de teste 39035896941](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39035896941) aprovados, mesmo fingerprint **bf48331dd8c6db8bb920cec3dabe9d2dc24b24bf1c1b93e1e77cf8b89d07944a**. Aplicação **6021**, PostgreSQL17 restrito **709**, interface **691**: total **7421**, zero falhas/skips/cancelamentos/todo. Tipos,45 operações OpenAPI, build, lock, instalação e auditoria integram os gates. Varredura de segredos é heurística. Nenhuma migration/SQL/grant/dependência nova.

Artefato original **helpdesk-homologation-6a1d3de4558041a4b29cc1ef7949c96e0311d253-39035894346-1**, digest **sha256:37b9aaad8a07322480b6b945410b237adb5a84609b62ee6a3c14d3d08e4de1b4**. Relatório e seis logs originais preservados sem normalizar bytes; hashes verificados. Artefato independente do merge também baixado/conferido contra o mesmo fingerprint. [Fonte](../../evidence/recovery-reconcile-20261017/ci-qualified.json) e [merge](../../evidence/recovery-reconcile-20261017/merge-ci.json).

Local:107 testes focais, compilador direto e regressões de filesystem aprovados. A revisão independente encontrou omissão dos limites herdados; ajuda/spec/runbook corrigidos com regressão RED/GREEN de1.000 registros individualmente válidos e únicos sob2MiB, recusados atomicamente pelo orçamento do planejador. Nenhum outro achado acionável. O revisor passou33 testes;2 fixtures recusaram criação de links com EPERM do sandbox, enquanto o executor principal elevado passou ambas. [Revisão](../../evidence/recovery-reconcile-20261017/review.json). O primeiro npm typecheck ficou pendente e não foi contado; compilador direto e CI integral concluídos.

Sem mudança de UI/HTTP; testes de interface qualificam regressão do produto, não aceite humano autenticado nem restore. As primeiras prévias falhas estão preservadas e não foram aceitas. Preview após incorporar este relatório ainda em conferência; PR74 segue separado e sem merge/publicação. Produção permanece PR73/d8f1fe2/deploy6ad37227af6d1784b1404bad.

## Prévia qualificada e entrega para revisão

[Preview PR74](https://deploy-preview-74--helpdesk-consultegeo.netlify.app), deploy **6ad3784af5ff26b220660d90**, head **8aa66bad7d68af145a5ecdf8094447de962b7cb5** READY:10 ativos críticos conferidos por bytes/hash. HTML admite somente inserção CDP restrita do provedor. [Recibo](../../evidence/recovery-reconcile-20261017/preview.json). A conferência do head final fica no corpo do PR, evitando modificar novamente a fonte só para registrar sua própria prévia. Não houve novo aceite humano autenticado ou escrita de negócio. Produção continua PR73/d8f1fe2. PR74 pronto para revisão; **não mesclado nem publicado**. Este estado atualiza a pendência de prévia acima.
