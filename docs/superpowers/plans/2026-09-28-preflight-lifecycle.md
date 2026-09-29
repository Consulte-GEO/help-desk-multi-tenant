# M1-R3 — plano de implementação

> Execução inline nesta sessão; aplicar TDD e verificação antes de conclusão. Sem subagente disponível, revisão será pelo mesmo executor e assim identificada.

**Objetivo:** tornar falhas assíncronas e transporte encerrado resultados restritivos do preflight.
**Arquitetura:** manter CLI privada, pool exclusivo, transação read-only e gates existentes.
**Stack:** Node22/TypeScript; TLS nativo e OpenSSL apenas na ferramenta de teste.
**Spec:** docs/superpowers/specs/2026-09-28-preflight-lifecycle.md.

## Restrições globais
Não alterar as 11 migrations, lock, API/schema nem atendimento. Não escrever em serviços remotos. Não usar mocks como evidência PostgreSQL. Não remover assertions/skip para aprovar.

## Revisão prioritária
Evento depois de uma consulta resolvida; erro durante descarte; listener preexistente; certificado autorizado em socket já fechado; limpeza de conexões quando o teste falha.

## Tarefa 1 — eventos do cliente
- [x] Criar fixture EventEmitter explícito e regressão de processo antes do patch.
- [x] Confirmar falha pelo evento sem listener e vazamento do erro sintético no processo filho.
- [x] Modificar somente contrato opcional de evento SqlClient e runRuntimePreflight; impedir novas consultas após falha.
- [x] Confirmar testes focados e suíte total.

## Tarefa 2 — sockets TLS reais
- [x] Criar helper de servidor TLS em loopback com cert/chave temporários.
- [x] Provar que R2 aceita socket autorizado já destruído; não contar erro de setup como RED.
- [x] Rejeitar sockets encerrados sem relaxar CA/hostname; preservar testes anteriores.
- [x] Rodar transporte real e suíte total, registrando OpenSSL/Node e limites.

## Tarefa 3 — integração e revisão
- [x] Atualizar mínimo do gate, documentos de evidência/handoff/backlog e tarefa Codex.
- [x] Tentar verify/SQL/browser/audit com tempos limitados, sem contornar política.
- [x] Revisar diff e gerar pacote cumulativo R2+R3 sobre b948, mais delta R3 para R2 já integrado.
- [x] Reaplicar ambos os patches em árvores limpas; conferir fingerprints/manifests e testes.
