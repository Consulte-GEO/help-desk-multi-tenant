# Handoff — Help Desk M1-R3

**Base remota consultada:** `b9481b9fabde2fd9c442e44099bc17608b59571a`, branch `codex/m1-reproducibilidade`. **Estado:** incremento local; M1 aberto.

## Leia antes de alterar
PROJECT_HELP_DESK.md, README/AGENTS e docs04/05 do checkout **atual**, docs29–33 deste pacote e especificação/plano `2026-09-28-preflight-lifecycle.md`. O mestre original não é substituído: seu cabeçalho aponta a evidência atual e preserva o histórico.

## Entrega
R2 + correções R3: listener no cliente de diagnóstico, bloqueio de consultas após evento fatal, recusa de socket TLS encerrado, teste de handshake real em loopback, comando `test:tls:local` e gate mínimo1114/204/71. Sem novos endpoints, migrations, grants ou dependências npm. OpenSSL CLI é pré-requisito de teste, não componente novo do servidor de atendimento.

1.114 aplicação aprovados (15 novos sobre R2, 69 sobre base remota); seis TLS reais estão incluídos. 35 HTTP em memória passaram. Nenhum PostgreSQL/browser aprovado nesta rodada. npm ci/audit/typecheck padrão e gate seguem bloqueados. Typecheck global suplementar passou. Não promover estes resultados a operação real.

## Aplicar uma única variante
O ZIP inclui um patch **R2+R3 sobre b948** e outro **somente R3 sobre R2**. Não aplicar os dois. Confirmar HEAD, alterações concorrentes, manifesto, preimages e caminhos novos; usar `git apply --check` antes de `git apply`. Overlay é para revisão, não para cópia indiscriminada. Se qualquer preimage divergir, conciliar o código; não forçar aplicação ou trocar hashes.

A recuperação local confere fonte executável por fingerprint, mas não representa todo o histórico/documentação do remoto. Não usar os commits locais para force-push, nem restaurar o bundle original sobre GitHub. Após integração, atualizar os docs04/05 reais com as evidências novas sem apagar as anteriores.

## Próxima execução
1. Reinspecionar HEAD e integrar a variante correta em branch local revisável.
2. Confirmar OpenSSL; executar `npm ci --ignore-scripts`, `npm run verify`, `npm audit --audit-level=high` usando o lock real existente. Não substituir por tipos globais ou outro registry.
3. Executar PostgreSQL17 descartável:204 casos (188 principais+16upgrade), sem skips. Não apontar o runner de fixtures para Supabase remoto.
4. Executar `npm run test:tls:local` e `npm run test:ui:local` (35HTTP+36browser); depois homologate:local/check:homologation, com fingerprint novo. Não editar logs anteriores.
5. Em destino autorizado, testar preflight com **pg8.16.3 e TLS real**, incluindo queda da conexão entre queries, rollback sem confirmação e cleanup. O teste Node TLS não tem protocolo PostgreSQL e não cobre isso. Confirmar também duração/encerramento reais se o driver falhar.
6. Projetar/validar execução privada na Function e login/Auth/M2M em homologação, com autorização atual; não abrir HELPDESK_RELEASE_APPROVED em produção para contornar o teste.
7. Prosseguir com capacidade/abuso, restauração, residência/RPO/RTO e revisão independente. M2 somente após fechamento de M1.

## Pontos de revisão
Listeners já existentes não podem ser removidos. Erro bruto não entra no relatório; após quebra não há consulta nova nem reconexão automática. Falta de ACK de rollback é falha, não sucesso por ter descartado o cliente. Variáveis de produção permanecem intocadas. Credenciais/certificados efêmeros de teste nunca devem ir ao Git. Migrations remotas já aplicadas têm mapeamento próprio de timestamps: não reaplicar ou usar migration repair automaticamente.

Sem autorização explícita atual, nenhuma escrita remota. Os comandos de desenvolvimento aqui não constituem autorização de operação externa.
