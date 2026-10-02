# M1-R14 — Cancelamento das respostas recusadas do provedor de identidade

## Problema observado e limite
A fonte executável R13 foi reconstruída com fingerprint exato
`0b90a9bc12d397e2d7607307a8287bec447f056bafe83419660df6e7dac32c66`.
Baseline: 1.333 testes Node aprovados. Não há instalação padrão, PostgreSQL ou
navegador aprovados nesta rodada. O remoto continua no R9 integrado.

A revisão de `src/infrastructure/authentication.ts` identificou que respostas
HTTP recusadas por status retornam sem consumir ou cancelar o corpo. A hipótese
é que um provedor que mantenha o corpo aberto deixa recursos ocupados até o
abort/encerramento posterior, mesmo após a autenticação já ter sido recusada.
Isso precisa de reprodução local; não constitui incidente no Supabase hospedado.

## Especificação objetiva
1. Cancelar uma única vez o corpo de resposta que não será usado, antes de
   devolver a recusa já existente. Não ler nem interpretar o corpo de erro.
2. Preservar 401/unauthorized para as recusas e 503/auth_unavailable para 429/5xx.
3. Não esperar por um cancelamento pendente. Exceções síncronas e rejeições
   assíncronas de cancelamento não substituem a decisão nem são logadas.
4. Não consultar o banco em nenhum desses caminhos; não adicionar retries.
5. Resposta humana válida continua no leitor JSON limitado a 64 KiB e no
   timeout compartilhado de 5 segundos. Autorizações continuam no banco.
6. Não alterar endpoints, schema, migrations, grants, dependências, login,
   refresh/logout, MFA, sessão M2M ou gate de produção.

## Execução prevista
- Regressões com ReadableStream e respostas sintéticas: 400/401/403/429/500/503,
  erro/pendência de cancelamento, corpo vazio e controle positivo.
- Socket HTTP local com fetch nativo: servidor próprio mantém o corpo aberto;
  verificar encerramento antes do timeout de fetch. Identidades e SQL sintéticos.
- Executar RED antes da correção, GREEN, regressão completa e validações possíveis.
- Registrar tentativas que falharam, review, riscos e pacote cumulativo R10–R14.

## Fonte técnica externa
Undici, implementação de fetch usada pelo Node, recomenda consumir ou cancelar
corpos em vez de depender do garbage collector para liberar conexões:
https://undici.nodejs.org/#garbage-collection
Esse documento fundamenta o risco; não comprova os testes do Help Desk.

## Aceite e não alegações
Aceite local exige cancelamento observado, recusa preservada, zero consultas
SQL nesses erros, sem leitura do corpo e sem retry; socket real precisa fechar.
Isso não equivale a homologação do Supabase, TLS remoto, capacidade ou residência.

## Resultado observado
RED: 12 falhas e 2 controles aprovados. GREEN: 14/14; suíte total 1.347.
Os três sockets nativos (401/429/503) permaneceram abertos antes da correção e
fecharam no prazo de observação após o cancelamento. A análise não constatou
incidente em produção nem mediu esgotamento de conexões ou capacidade.
