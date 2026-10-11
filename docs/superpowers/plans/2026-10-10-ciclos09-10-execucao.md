# Ciclos 09 e 10 — anexos e abertura estruturada

> Execução inline: superpowers:executing-plans; testes negativos antes de implementação. Autorrevisão não é revisão independente.

**Objetivo:** ligar upload privado/quarentena/recibo ao rascunho e ao commit estruturado, sem contornar pendências de infraestrutura.
**Base:** pacote local C07/C08, SHA256 706d06de6ccb7ad3d6beb640597ed5ed020bff006fbf54e53210445794dba59c; remoto PR26 f60baed.
**Spec vinculante:** plano de implantação, CG07 linhas233–253 e CG10 linhas299–321; spec complementar não recuperada.
**Arquitetura:** módulos do core genérico, adapters construídos pelo servidor, execução de negócio no executor transacional existente. Nenhum bucket, scanner ou serviço pago será criado. Nenhuma capability de produção será ativada por existência de testes.

## Regras preservadas
UTC exato; identidade/conta/recurso distintos; cinco scopes de negócio inalterados; sem permissões por e-mail; sem upload binário na Function; não sobrescrever objeto analisado; nenhuma evidência clean de stub em produção; prévia não autoriza commit; recibos e versões imutáveis; rascunho com TTL e CAS; confirmação perdida mantém chave/conteúdo; sem novo protocolo no replay. As12migrations, lock, gates e configuração hosted não serão alterados.

## Tarefas e interfaces
1. [x] Domínio attachment: binding de pessoa/conta/refs/form/campo/draft/revisão, política explícita, metadata e scan report. Testes: arquivo alheio, versão/hash divergentes, pending/unsupported/timeout, MIME e nome perigosos.
2. [x] Inspeção streaming e worker: SHA256/bytes reais, assinatura indicativa de tipo, limites, scanner obrigatório, objeto selado e lease vigente. Recusar ZIP/Office/ativo sem handler qualificado, sem descompactar. Testar interrupção, leitura parcial e resposta stale.
3. [x] Serviço attachment: reserva idempotente+quota, upload direto, finalização em quarentena, revalidação antes de download, evidência de formulário consultada no store corrente. Provider/store reais continuam requisito de montagem.
4. [x] Draft/intake: salvar e recuperar rascunho com dono/TTL/CAS, prévia sem escrita/protocolo, commit com schema/receipts/coverage atuais, prioridade e clocks existentes, evento/outbox mínimo e protocolo. Store borrowed-client com todas as gravações atômicas. Replay autoriza o ticket atual e não enriquece snapshot.
5. [x] Montagem HTTP opcional e UI: JSON-only, limites, auth/quota/origin, revisão+idempotência, upload/resume sem segredo persistido, revisão e conciliação explícita.
6. [x] Testar composição, reverter mutações de prova, rever diff, gerar pacote cumulativo e handoff que distingue testes sintéticos de serviços reais.

## Rulings
- Tipos de arquivo não qualificados ficam unsupported; não simular scanner de ZIP/macro por busca de texto.
- Sem PG17/CLI disponível e com escrita SQL remota anteriormente bloqueada, não reenviar por outra ação. Não fabricar migration ou aprovação do banco.
- Infraestruturas de produção serão interfaces estritas, não mocks montados. Os doubles ficam apenas em tests/helpers.
- Código atual será preservado; não inventar taxonomia/perfil/provider nem anunciar fechamento integral destes ciclos.

## Revisão dirigida
Objeto muda depois do scan; revogação entre prévia e envio; reenvio após COMMIT perdido; dois envios com chaves diferentes no mesmo draft; timeout/cancelamento sem aprovação tácita; arquivo interno em resposta pública; rascunho com revisão diferente; autorização do beneficiário não vira grant global.

## Resultado desta execução
Os cinco componentes locais foram implementados. [x] não significa SQL, provedor, navegador, CI ou produção aprovados. Ver `docs/operations/CICLOS09-10-2026-10-10.md` e logs da entrega. A tarefa6 encerra o pacote após a última verificação; gates de integração seguem abertos.
