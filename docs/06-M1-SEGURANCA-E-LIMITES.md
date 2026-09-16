# M1 — Segurança, persistência e limites — v0.2.0

## Alcance e estado

Incremento de engenharia sobre a v0.1.0, na branch local `work/helpdesk-m1-v0.2.0`. **M1 permanece em andamento.** Os controles TypeScript estão codificados e testados localmente; as migrations 003/004 e 35 cenários SQL precisam de PostgreSQL 17 real. Nenhuma migration foi executada nesta rodada, local ou remotamente. Nenhum ambiente remoto foi alterado.

A arquitetura permanece: API própria → autorização de domínio → conexão PostgreSQL restrita → schemas privados. Workspace, conta, produto/instância e contrato/versionamento continuam distintos. Não há nova dependência de um sistema consumidor nem mudança no projeto Supabase de destino.

## 1. Resultado idempotente não é autorização permanente

Uma resposta de criação salva não pode conceder acesso depois da revogação do vínculo. O serviço reautoriza o ticket antes de devolver uma criação repetida. O banco candidato vincula o registro de reenvio à conta e ao ticket reais por FK composta e disponibiliza a leitura somente pelo helper privado `helpdesk_auth.lookup_idempotency`.

Esse helper revalida escopo de leitura, acesso ao ticket e, para notas, capacidade interna atual. Uma negativa retorna somente um sinal de acesso negado, sem hash, corpo ou metadados do resultado anterior. O papel HTTP perde SELECT direto na tabela de idempotência. O registro continua transacional com o chamado, evento e outbox. Nenhum e-mail ou webhook foi implementado neste marco.

Após a expiração do corpo, a mesma chave retorna `409 idempotency_expired`. O consumidor deve reconciliar o recurso existente antes de decidir por uma nova operação. Não orientar geração automática de outra chave após timeout: isso pode duplicar uma intenção de negócio.

UUIDs recebidos na API são normalizados para minúsculas; identificadores opacos que não são UUID mantêm sua caixa. Isso evita diferenças entre seletores HTTP e UUIDs canônicos retornados pelo PostgreSQL.

## 2. Defesa em profundidade no banco candidato

A migration `20260915000300_m1_authorization.sql` acrescenta policies restritivas aos controles de relacionamento existentes: scopes de tickets, mensagens, notas, cobertura e idempotência. O helper de cobertura, por ser privilegiado, executa também a própria verificação de escopo. A autoria de uma resposta pública deve corresponder ao ator; uma integração não pode declarar-se atendente humano.

Há proteção de transição no banco, além da máquina de estados da aplicação. Cliente só pode reabrir ou fechar um chamado resolvido dentro das permissões existentes. Tipos de evento e visibilidade interna/pública são restringidos. Versões publicadas e contexto original do ticket continuam protegidos pelos controles anteriores.

A migration `20260915000400_m1_resource_limits.sql` acrescenta quota de sessões, contadores compartilhados, lifecycle de idempotência, manutenção técnica e marcador de versão do schema. **Esses arquivos são candidatos, não SQL homologado.** Os testes locais de texto/modelos controlados não executam policies, triggers, FKs ou locks PostgreSQL.

## 3. Conexão e falhas de infraestrutura

O runtime exige o login `helpdesk_app` como usuário efetivo e como login da sessão. Recusa privilégios administrativos, associação a outros papéis e propriedade dos objetos privados. TLS mantém `rejectUnauthorized: true`; a URL não aceita query string nem fragmento que possa alterar a configuração do driver. O CA pode ser fornecido somente no backend.

O pool usa uma conexão por instância. Cada unidade de trabalho configura workspace/principal e timeouts somente na transação. Rollback falho descarta a conexão. Falhas ao adquirir conexão tornam-se `503 database_unavailable`; códigos transitórios conhecidos são devolvidos com mensagem segura e Retry-After. Erros de conexões ociosas são observados sem registrar a mensagem bruta, URL ou credencial, e uma falha do logger não lança erro para o callback do pool.

Na inicialização são verificados marcador `0.2.0`, 23 tabelas privadas, ENABLE/FORCE RLS e ausência de exposição de schema a PUBLIC/anon/authenticated/service_role e de EXECUTE público nos helpers privados. Esse guard detecta alguns desvios de configuração; **não prova a semântica das policies, não substitui auditoria e não é monitoramento contínuo de alterações**.

`app.workspace_id` e `app.principal_id` são seletores definidos pelo backend autenticado, não credenciais. Comprometimento do backend ou do login do banco continua sendo um risco sério. Não alegar que RLS, sozinha, protege contra um invasor com controle arbitrário do runtime.

## 4. Limites propostos e respostas

Os valores abaixo são parâmetros iniciais de engenharia. Não foram homologados por teste de carga, volumes de negócio ou infraestrutura real. Ajustes devem ser versionados e testados; não são configurações de cada browser.

| Controle | Valor inicial | Comportamento |
|---|---:|---|
| Ingresso por IP confiável | 120 / 60 segundos | 429 e Retry-After |
| Troca M2M por IP | 10 / 60 segundos | Limite adicional ao ingresso |
| Principal dentro do workspace | 120 / 60 segundos | Consumo após autenticação |
| Workspace | 1.800 / 60 segundos | Orçamento compartilhado |
| Sessões M2M ativas por conexão | 50 | Reutilizar sessão curta, não gerar por request |
| Corpos de reenvio válidos por principal/workspace | 5.000 | Recusa nova reserva se excedido |
| Mensagens/notas/timeline por página | Padrão 50; máximo 100 | Cursor para continuação |
| Coberturas examinadas por contexto | 100 | Erro explícito se configuração excedida |
| Corpo HTTP JSON | 64 KiB | 413 |
| Política contratual serializada | 16.384 bytes | Constraint candidata |
| Snapshot contratual serializado | 20.000 bytes | Constraint candidata |
| Resultado de idempotência serializado | 98.304 bytes | Constraint candidata |

A metadata de IP vem de `context.ip` do Netlify. Headers de encaminhamento enviados pelo cliente não são autoridade. O código normaliza IPs, inclusive IPv4 mapeado em IPv6, e usa HMAC para os identificadores de contagem. A chave `HELPDESK_RATE_LIMIT_HMAC_KEY` é exclusiva do backend e não foi gerada/provisionada em nenhum ambiente remoto.

As janelas são fixas de 60 segundos. A rotina SQL usa locks transacionais em ordem determinística e consumo conjunto dos orçamentos. Contadores compartilham PostgreSQL, não memória por instância. Falta de IP confiável, erro ou resposta inválida do limitador fecha o caminho com 503. Não há fallback silencioso para contador local. Limites de banco não substituem proteção de borda contra DDoS; fronteiras de janela permitem rajadas e os custos adicionais de consulta precisam ser medidos.

## 5. Retenção técnica não é exclusão de histórico

| Dado | Política candidata |
|---|---|
| Corpo de resposta de idempotência | Reproduzível por 7 dias |
| Chave/hash de idempotência | Preservados por 90 dias; tombstone após expirar corpo |
| Sessão M2M expirada | Elegível para limpeza após 1 dia da expiração |
| Contador de rate limit antigo | Elegível após 1 dia |
| Ticket, mensagem, nota, evento e outbox | **Não são apagados por esta manutenção** |

O papel `helpdesk_maintenance` é separado e criado sem login pela migration candidata. Só pode executar a rotina limitada `helpdesk_auth.maintain_ephemeral`; o papel HTTP não recebe essa permissão. Credenciais, agendamento e aprovação da frequência continuam pendentes. A função inicia em dry-run, opera até 500 itens por categoria por padrão e aceita no máximo 1.000.

Em um banco descartável já migrado, o administrador de homologação pode simular o papel:

```sql
begin;
set local role helpdesk_maintenance;
select helpdesk_auth.maintain_ephemeral(true, 500);
rollback;
```

O modo `false` modifica somente as quatro categorias técnicas. Exige revisão dos resultados e procedimento operacional aprovado. **Nenhum scheduler foi criado ou executado nesta entrega.** Após 90 dias a garantia da chave expira; integrações de negócios devem conservar seus próprios identificadores de operação quando precisarem de deduplicação mais longa.

## 6. Paginação e interface

`GET /v1/tickets/{id}/messages`, `/notes` e `/timeline` recebem `limit` e `cursor`, devolvendo `items` e `next_cursor`. A ordem da API é do mais recente para o mais antigo, usando data e ID. O cursor fica vinculado a tipo de coleção, ticket, workspace, principal e projeção interna. A API rejeita parâmetros duplicados/malformados e reautoriza o recurso em cada página. Cursor não é prova de autorização.

O frontend apresenta cada conjunto carregado em ordem cronológica e permite carregar mensagens/notas anteriores. O módulo de estado diferencia perfis, tickets e tipos de conversa, limpa o contexto antigo e descarta respostas atrasadas. Os testes desse estado passaram. **A renderização, responsividade e acessibilidade em navegador não foram homologadas**, pois a navegação foi bloqueada pela política do ambiente.

Mudança de contrato na pré-versão 0.2.0: consumidores que esperavam arrays ilimitados em ordem crescente precisam passar a consumir `next_cursor` e tratar a ordem documentada. Não foram integrados consumidores reais nesta rodada.

## 7. Instalação, CI e execução segura

`deps:resolve` gera um lockfile verdadeiro usando npm em um ambiente com registry autorizado e só então tenta instalação limpa e audit. Nesta rodada a resolução falhou por DNS; nenhum lockfile foi fabricado. As versões declaradas foram fixadas a partir das versões candidatas anteriores, não selecionadas como as mais recentes nem aprovadas por auditoria.

O CI agora exige lockfile coerente, usa `npm ci --ignore-scripts`, audit e suíte PostgreSQL. As ações checkout e setup-node foram fixadas nos SHAs dos tags consultados; isso identifica o código, não equivale a auditoria de segurança das ações. O workflow não foi executado no GitHub. O build de publicação Netlify exige `verify:release`; o build estático isolado continua sendo apenas cópia de assets.

`test:db:local` aceita somente Docker local e cria um container descartável rotulado, com porta de loopback, banco dedicado e senhas aleatórias. O teste recusa targets remotos, overrides de conexão, outro banco, usuários inadequados e schemas Help Desk existentes; não apaga banco alheio. O executor não teve condições de criar um container neste ambiente, que não possui Docker. Em CI, as senhas legíveis pertencem somente ao serviço descartável do job, não a credenciais de produção.

## 8. Fontes técnicas de implementação

As fontes externas orientam o desenho; nenhuma comprova que nosso SQL foi executado:

- PostgreSQL 17, Row Security Policies: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- node-postgres, SSL: https://node-postgres.com/features/ssl
- Netlify Functions API, Context: https://docs.netlify.com/build/functions/api/
- Supabase, Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

## 9. Saída do M1

M1 somente será concluído após instalação/lock/audit reproduzíveis, execução dos 35 cenários SQL com papel real, revisão de todos os achados, Auth/pooler/Functions reais, verificação da Data API, abuso/carga e navegador. **Não ativar `HELPDESK_RELEASE_APPROVED` para contornar as pendências.**
