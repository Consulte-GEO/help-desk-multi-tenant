> **M1-R22 — 02/10/2026:** código R20/R21 na branch `codex/m1-r21-integracao-r20`; evidências originais do CI 37021243365 incorporadas e verificadas, sem mudança executável. 1436 Node, 215 PostgreSQL 17 e 71 HTTP/browser são resultados do runner. Revisão independente e aceitação hospedada continuam pendentes. M1 aberto; M2 não iniciado. Leia `docs/111-M1-R22-EVIDENCIAS-E-INTEGRACAO.md`. Não abrir o gate operacional.

> **Integração Codex — 02/10/2026:** R10–R19 integrado; CI Linux 1417 Node, 215 PostgreSQL17 e 71 HTTP/browser aprovados. Lock, audit e typecheck aprovados; evidência única verificada. Leia docs/105-M1-R19-INTEGRACAO-CODEX.md. M1 operacional permanece aberto. Autorização atual permite commit, merge e publicação sem Claude; estados e restrições antigos abaixo são históricos.

# Estado de continuidade — M1-R19 / 01-10-2026

**Código executável:** R18, sem alteração funcional nesta rodada. **Base remota:** R9 `78bbb00112331531168ae24600604cb7f3148770`. **M1 aberto; M2 não iniciado.**

Leia primeiro [estado atual](docs/102-M1-R19-ESTADO-E-EVIDENCIAS.md), [handoff/backlog](docs/103-M1-R19-HANDOFF-E-BACKLOG.md) e [tarefa executável](docs/104-M1-R19-TAREFA-CODEX.md).

Revalidação nesta sessão: **1.417 testes Node aprovados**, 35 HTTP em memória; instalação/audit/typecheck padrão, PostgreSQL, navegador e gate não aprovados. O Supabase e o Netlify foram inspecionados somente por metadados. Não houve execução SQL remota, autenticação hospedada ou alteração externa.

R19 consolida documentação e evidências: não adiciona código, testes, comandos ou permissões. O fingerprint executável permanece `66b19776e652a210ebc819e49dac7650bb27eae00c269b8c186ab55e90d84491`. A próxima ação é integrar R10–R18 e executar a validação em ambiente apto, não criar uma nova suíte para substituir esse teste.

## Leitura do histórico
Os preâmbulos cronológicos anteriores estão preservados integralmente em [histórico de introduções](docs/history/r18-project-introductions-before-r19.md). O documento mestre original abaixo está preservado literalmente; suas datas, números e destinos históricos não são estados atuais. Em especial, as seções 3, 14–16 e 29 exigem confronto com o estado R19. As decisões arquiteturais e as restrições de operações externas permanecem obrigatórias.
