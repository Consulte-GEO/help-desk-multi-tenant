# M09c — plano de implementação

Spec: docs/superpowers/specs/2026-10-13-consultegeo-m09c-design.md. Execução inline autorizada pelas decisões e pedido do usuário. Base ca40dfcef5a372e40f5cc1c58053c68d06b77b50. Reutilizar worktree codex/consultegeo-m02.

## Global Constraints
Primeiras 15 migrations e seis candidatos M05 imutáveis. Não instalar remotamente. Não enviar emails. Nenhuma autoridade inferida de seletores/nomes/emails. Um cliente transacional, confirmações obrigatórias e validação sticky. APIs0.30.0/schema0.23.0.

## Task 1: escritor e efeitos nativos
Interfaces: SupportIntakeTransaction + FormDraftTransaction no store emprestado; commitRequest recebe também a intenção original; RPCs hdni_coverages/receipt/authorize_receipt/allocate_protocol/create. Tabelas contador, snapshots e recibos privados. Adicionar testes de ACK e cenários nativos antes do escritor. Esperado RED: store não possui allocator/criação. Depois implementar migration16 e recuperação do rascunho consumido. Verificação: testes focais, typecheck; PostgreSQL17 via CI original.

## Task 2: montagem HTTP e contratos
Interfaces: opções runtime compõem o mesmo store; duas rotas /v1/support-requests/preview e /v1/support-requests. Testes origem/MFA/If-Match/key/gate/ACK. Esperado RED: handler ausente. Implementar montagem e contratos/versionamento/inventário explícito, preservando prefixos. Verificação: npm verify, CI original (sem alterar gates).

## Task 3: qualificação e entrega
Interfaces: CI report/fingerprint/seis logs originais, uma revisão final. Expected: todas suites verdes e inventário igual ao contrato estático. Atualizar relatório145/README/AGENTS/matriz, evidências e ZIP incremental. Preservar PR31 draft. Arquivar ledger e excluir só scratch próprio após verificação.

## Review Focus
SQL bruto deve recusar bundle/recibo/preview forjados, confirmação vazia, supressão e efeitos incompletos; TTL/acesso/cobertura após espera; concorrência mesma chave e mesmo rascunho; replay após TTL e após evolução do ticket; funções privadas sem grants amplos; clocks/canonicalização Unicode iguais ao domínio; cancelamento após dispatch não inventa rollback confirmado.
