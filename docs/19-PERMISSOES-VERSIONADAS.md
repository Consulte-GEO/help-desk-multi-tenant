# v0.15.0 — Permissões humanas versionadas e reenvio de notas

## Decisão de desenvolvimento
Recorte R14-04/R14-05 da revisão anterior. Não é o backoffice M2, não encerra M1, não autoriza escrita remota. O escopo continua sendo a interseção de identidade ativa, workspace, vínculo/role, recurso e capacidade. Permissões globais no workspace são um teto: não concedem acesso a contas novas.

Uma tabela privada `helpdesk_auth.human_scope_versions` guarda versões append-only por workspace/pessoa: capacidades, motivo, UUID de correlação, login PostgreSQL responsável e instante. A ausência de versão concede zero capacidades. Novos vínculos não criam permissões automaticamente. Na migration 009, humanos ativos já vinculados recebem uma única versão inicial com as cinco capacidades legadas; o upgrade preserva, não reduz silenciosamente, os direitos existentes.

`resolve_human` e `has_scope` usam a mesma função privada para a última versão. Admin também obedece às capacidades. Uma revisão nova afeta novas consultas/transações; não cancela trabalho já autorizado nem oferece revogação instantânea de JWT. Não há escopos diferentes por conta nesta fase: os vínculos por conta seguem delimitando os recursos.

`set_human_scopes` foi preparado com SECURITY INVOKER e sem EXECUTE para helpdesk_app, PUBLIC e roles de clientes. Destina-se ao executor privilegiado de provisionamento, não a uma rota HTTP. Exige revisão esperada (zero para primeira), motivo e request UUID. Trigger serializa alterações por par, impede lacunas de revisão e captura session_user; UPDATE/DELETE são recusados. O histórico não é WORM e não resiste a um dono malicioso que altere DDL.

Reenvio de `notes.create` exige tickets:read, notes:write e operador da conta. Recupera apenas o recibo do próprio comando autenticado, não a coleção de notas; notes:read não é concedido para isso. notes:read sem notes:write não permite repetir a criação. Uma chave alheia continua inacessível por namespace. O cache não recebe novo prazo e não é regravado.

## Sequência de implementação e prova
1. Escrever testes de validação de capacidades e plano de provisionamento; observar falha; implementar contrato compartilhado usado pelo principal autenticado. Plano gera SQL parametrizado/valores sem executar rede.
2. Escrever sentinelas da migration 009 e regressões de fluxo de notas; implementar tabela/helper/setter/guard e substituir somente resolve_human, has_scope e lookup_idempotency em nova migration. Oito migrations anteriores devem permanecer intactas.
3. Atualizar contrato de prontidão e versão de schema. Adicionar testes SQL reais de perfil somente leitura, notes-write-only, ausência, revogação, concorrência, cliente/provedor, histórico e upgrade. Testes não executados serão marcados como pendentes.
4. Executar suíte local, typecheck, contratos, integridade, build e tentativas de DB/UI/dependências. Registrar resultados por comando. Entregar ZIP e bundle sem publicação.

## Pendência distinta
R14-06 (obrigação SQL generalizada de evento/outbox para mudanças de estado e mensagens) permanece separada: não modificar regras/fixtures desse domínio para aparentar conclusão desta rodada.

## Contrato implementado e escopo da configuração
API/interface e schema candidato0.15.0; nove migrations,24 tabelas e18 operações HTTP em14 caminhos. Nenhum novo endpoint de administração foi criado. As cinco capacidades são exatamente:

| Capacidade | Operação delimitada |
|---|---|
| `contexts:resolve` | Consultar opções de suporte e resolver cobertura autorizada. |
| `tickets:read` | Ler chamados visíveis ao principal. |
| `tickets:write` | Operações de escrita de chamados, ainda sujeitas ao vínculo e às regras de estado. |
| `notes:read` | Ler a coleção privada, ainda exigindo acesso ao chamado e ser operador. |
| `notes:write` | Criar a própria nota e recuperar seu recibo, sem acesso geral às notas. |

Nenhuma capacidade implica outra. `notes:write` sem `tickets:read` não habilita a criação, porque o recurso pai precisa ser autorizado. O papel administrador também não supre uma capacidade ausente. As regras existentes de acesso por conta não mudaram. Este é um **teto de capacidades por pessoa/workspace**, não um conjunto de escopos distinto para cada conta. A remoção de uma capacidade vale para os recursos desse workspace; não altera outros workspaces da mesma pessoa.

## Provisionamento inicial e atualização

1. Homologar a migration009 em PostgreSQL17 descartável, revisar o backfill e o login responsável. Não executar no Supabase do usuário para substituir um teste local bloqueado.
2. Para novos humanos: provisionar a identidade e o vínculo no fluxo administrativo aprovado. Sem revisão de capacidades, o principal pode ser reconhecido em `/me`, mas não recebe operações de suporte. Esta entrega não cria pessoas, vínculos ou convites.
3. Preparar um JSON conforme `examples/human-scope-change.json`, com IDs reais do ambiente **somente no arquivo administrativo local**, capacidades explícitas, revisão atual, motivo e UUID de correlação. Não incluir senha ou connection string.
4. Validar sem conectar ao banco:

```bash
npm run --silent scopes:plan -- examples/human-scope-change.json
```

A saída contém `executesDatabase:false`, SQL com placeholders e seis valores. É um **plano de execução**, não uma alteração realizada. A ferramenta rejeita campos adicionais, texto inválido, revisões negativas/não inteiras, capacidades repetidas/desconhecidas, arquivo não regular/symlink e entradas acima de16KiB. Seu limite é de bytesUTF-8; o motivo no plano também tem limite de1000 unidades UTF-16.

5. O executor de provisionamento aprovado deve ligar os seis parâmetros ao SQL, numa transação, usando uma identidade com privilégios reais e sem expor sua credencial ao browser. Os placeholders `$1`–`$6` não são valores para colar literalmente no console SQL. O loginHTTP não tem EXECUTE, DML ou SELECT sobre essa configuração; não ampliar o papel `helpdesk_app` para contornar isso.
6. `expected_revision=0` cria a primeira revisão; depois é obrigatório informar a revisão atual. Conflito SQLSTATE40001 exige recarregar e revisar, não reenviar automaticamente sobrescrevendo a decisão de outra pessoa. Mesmo uma lista idêntica cria uma revisão de intenção quando submetida corretamente. Lista vazia revoga todas as capacidades. Uma falha de conexão após COMMIT continua sendo resultado incerto: consultar a revisão/histórico antes de uma nova execução.
7. O histórico armazena a identidade **SQL** de provisionamento (`session_user`), instante de execução, motivo e UUID fornecido, além da versão e lista. Não registra automaticamente a pessoa humana de um futuro backoffice. UUID não é assinatura nem autorização e não fornece idempotência administrativa. O histórico não expira pela rotina de manutenção técnica existente; retenção precisa de decisão operacional específica.

### Compatibilidade do upgrade

O upgrade produz uma única revisão inicial para cada humano ativo com vínculo ativo já existente, mantendo as cinco capacidades legadas. Não cria vínculos nem converte integrações em humanos. Pessoas novas e relações reativadas que não receberam backfill não passam a ganhar capacidades implicitamente. Relações que já possuem uma revisão continuam consultando esse teto ao serem reativadas; revisar o teto junto com a decisão de reativação. Nenhum registro de chamado, contrato, cache ou mensagem é reescrito pelo backfill.

O ensaio preserva o limite antigo001–007→008 e depois aplica009. As comparações mantêm snapshots e datas técnicas; novos testes verificam os dois perfis legados provisionados. São testes escritos, **ainda não executados no PostgreSQL**.

### Recibo de uma nota sem acesso à coleção

Uma primeira criação e seu reenvio podem devolver o recibo original ao seu autor com `tickets:read + notes:write + operador`. Isso não habilita GET de notas nem revela notas alheias. Perder `notes:read` não inutiliza esse recibo; perder `notes:write`, acesso ao chamado ou o papel de operador passa a negá-lo. O helper mantém o namespaceworkspace/principal/operação/chave, a validação de integridade da v0.14.0 e os prazos originais do cache. Nenhum prazo é renovado e nenhuma operação é executada novamente por essa correção.

## Evidências e limites

905 testes locais aprovados,37 novos sobre868;35 checksHTTP de memória. Três novos arquivos de teste:22 casos do contrato/fluxo,7 sentinelas de schema/readiness e8 da CLI. A suíte SQL possui146 casos escritos (136 principais e10 de upgrade), nenhum executado nesta rodada. Os37 locais não comprovam SQL/RLS/concurrency, e o teste de nota usa memória. A interface permanece a anterior, com a versão atualizada;35 testes de browser continuam bloqueados.

O backoffice M2, R14-06, entrega de notificações, SLA operacional, anexos, conectores reais, restauração, carga e homologação do Supabase/Netlify não foram concluídos por este incremento. O `SECURITY DEFINER` e RLS desta migration precisam de execução real e revisão de privilégios antes de dados de clientes. As referências abaixo descrevem os mecanismos, não aprovam esta implementação.

## Fontes oficiais consultadas
- PostgreSQL17 — Row Security Policies: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- PostgreSQL17 — CREATE POLICY (inclusive interação com SELECT/RETURNING): https://www.postgresql.org/docs/17/sql-createpolicy.html
- PostgreSQL17 — CREATE TRIGGER: https://www.postgresql.org/docs/17/sql-createtrigger.html
- PostgreSQL17 — PL/pgSQL Trigger Functions: https://www.postgresql.org/docs/17/plpgsql-trigger.html
