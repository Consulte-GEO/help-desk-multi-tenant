# M1-R12 — Aceitação de gravações idempotentes

## Objetivo e fronteira
Dar execução ao item P0-WRITE do handoff R11, sem alterar o núcleo: cliente HTTP opt-in sobre rotas existentes. R9 upstream observado em 01/10/2026: 78bbb00112331531168ae24600604cb7f3148770. Fonte R11 recuperada com fingerprint 284f681dfe095b4ab7734d3baef73515f4c69084e52622c6a52f881b9996630a; baseline de 1.277 testes aprovados.

## Desenho
Reutilizar integralmente os 28 controles prévios R10 e quatro sessões pré-provisionadas. Somente depois de todas as leituras/negações passarem, conferir capacidades de escrita do solicitante A e agente A, cobertura explícita, criar um chamado sintético, uma mensagem pública e mudar a prioridade. Um identificador UUID fornecido no arquivo da execução gera chaves estáveis por operação. Nunca gerar outra chave para contornar resultado desconhecido, conflito ou expiração.

O arquivo contém exatamente schema, readFixture (formato R10), executionId e coverageId. Não aceita texto de negócio livre nem segredos. Origem imutável validada pelo R10. Plano não lê credenciais nem faz rede. Execução exige execute, allowTicketMutations, origem literal e hash SHA256 do arquivo lógico de configuração conferido no plano. A configuração é copiada antes da validação assíncrona; os tokens são copiados antes da primeira espera de rede.

## Dezoito verificações de escrita e leitura final
1. Escopo de escrita do solicitante A.
2. Escopo de escrita do agente A.
3. Resolução sem gravação e seleção da coverageId explicitamente declarada.
4. Criação (201), ou recuperação autorizada de execução anterior pela mesma chave (200 e replay=true).
5. Replay da criação com recibo/ETag idênticos.
6. Conflito 409/idempotency_conflict ao mudar assunto com a mesma chave.
7. Uma mensagem pública (201 ou recuperação 200).
8. Replay da mensagem com mesmo identificador/conteúdo.
9. Conflito 409/idempotency_conflict ao mudar mensagem com a mesma chave.
10. Prioridade high pelo agente, If-Match 2; recibo na versão 3.
11. Replay da prioridade com mesma chave/payload/If-Match 2.
12. Nova chave com If-Match 2 desatualizado: 412/version_conflict.
13. Replay da criação ainda na versão 1/normal, embora o chamado atual esteja na versão 3/high.
14. Consulta final do chamado na versão 3/high.
15. Coleção pública com exatamente uma mensagem da execução.
16. Histórico público com exatamente criação, mensagem e prioridade; sem justificativa interna.
17. Conta B não lê o chamado recém-criado.
18. Busca pela identificação da execução retorna exatamente um chamado no recorte autorizado.

A mensagem incrementa a versão 1 → 2; a prioridade incrementa 2 → 3. Nenhuma remoção automática: recursos e evidências permanecem para revisão. Não há endpoints DELETE de domínio neste cliente.

## Resultado desconhecido e limites
Cada operação registra a chave antes do envio, estado da confirmação e recurso somente depois da validação integral. Falha de rede, redirecionamento, JSON/headers/recibo inválido ou 503 numa mutação deixa o resultado desconhecido e interrompe todos os novos envios. Os únicos reenvios são cenários explícitos após confirmação, ou outra invocação deliberada com a mesma configuração imutável, mesmos principais e mesmas chaves; não são retries automáticos. Não seguir Location como URL; validar caminho relativo exato.

Relatório sem tokens, texto de chamado/mensagem, policy ou detalhes de erro. Somente metadados, IDs sintéticos, chaves de recuperação e resultados fechados. Resposta limitada a 64 KiB e 5 s; sem redirects/retries. Estado positivo de API não comprova banco/outbox: platform_approved, operational, postgres_tested, atomicity_verified, contract_snapshot_verified e outbox_delivery_tested permanecem false. A timeline é uma projeção HTTP, não leitura da outbox. Execução com fetcher injetado é identificada como `injected`.

## Critérios e fora do escopo
Testar o handler/domínio real em memória, perda de resposta depois de gravação e nova invocação mantendo chaves, conflitos, respostas hostis, falta de autorização, alteração concorrente de inputs, efeitos únicos no modelo de memória e socket loopback. Não chamar esses ensaios de PostgreSQL ou HTTPS hospedado. Não alterar API 0.19.0 / schema 0.18.0, migrations, lock, permissões, SLA, worker ou conectores. Não ligar gate ou ler credenciais remotas nesta rodada.

## Referência técnica externa
RFC 9110, seções 13.1.1 e 15.5.13, fundamenta If-Match/412; o replay histórico e a precedência da idempotência são contratos do próprio Help Desk, não uma nova regra atribuída ao RFC. Fonte: https://www.rfc-editor.org/rfc/rfc9110.html . Node 22 AbortSignal.timeout fornece o sinal de prazo; os limites e o leitor de resposta são controles do projeto.

## Limite de recuperação
A nova invocação só deve ocorrer com configuração/principais/chaves idênticos e retenção idempotente ainda íntegra. O cliente não consegue provar que um cache foi purgado. Uma chave expirada recebe diagnóstico explícito e bloqueia os envios; nunca é trocada automaticamente. Mudança nos controles/cobertura pode impedir o preflight antes do replay, sem alterar a semântica de replay do produto.
