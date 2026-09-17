# M1 — prontidão, integridade e upgrade / API 0.10.0

## Escopo
Evolução da homologação da base 0.9.0, sem acrescentar módulos de atendimento. A API/interface passa para 0.10.0; o schema continua 0.9.0. Nenhuma migration ou permissão remota foi criada ou alterada nesta execução.

## 1. Contrato de segurança na inicialização
A checagem anterior validava contagem de tabelas, ENABLE/FORCE RLS, schemas expostos a papéis clientes e EXECUTE público. Uma resposta com esses campos seguros, mas com privilégios extras ou invariantes desativados, não era recusada. A regressão local reproduziu essa lacuna com respostas controladas do driver, não em um banco real.

`database-security-contract.ts` define um inventário de desenvolvedor: 4 schemas, 23 tabelas, 28 funções, 28 policies, 10 triggers e 12 constraints nomeadas relevantes. Não é recebido da API nem gerado a partir do banco que será avaliado.

`database-security.ts` compara esse contrato ao catálogo PostgreSQL usando uma consulta somente de leitura com parâmetros. Não consulta linhas de chamados, mensagens, contas, credenciais ou tokens. Verifica:

- Objetos esperados e RLS obrigatório; ausência de objetos de relação inesperados nesses schemas.
- Privilégios efetivos do login de aplicação em tabelas e colunas, incluindo opções de delegação. Leitura direta de credenciais e UPDATE de identificadores não pertencem ao contrato.
- EXECUTE permitido somente nos helpers de request aprovados; manutenção e funções de trigger não são operações do login HTTP.
- Ausência de privilégios de objetos para PUBLIC e os papéis Supabase de cliente presentes; um schema privado não justifica deixar permissões latentes nos objetos.
- Assinaturas, tipo de função, SECURITY DEFINER, owner e search_path vazio.
- Triggers obrigatórios habilitados e com a função, tipo e diferimento esperados; nenhum trigger dos objetos inventariados pode estar desativado.
- Presença e validação das constraints nomeadas; nenhuma constraint remanescente não validada.
- Índices existentes válidos/prontos e índice único de eventos de atribuição presente.
- Conjunto de policies, comandos, papéis e caráter permissivo/restritivo.
- PostgreSQL 17, row_security ligado e session_replication_role de origem.

Relatório incompleto, NULL ou booleano textual não é aprovado. O erro público permanece `unsafe_database_policies`/503, sem nomes de objetos sensíveis ou detalhes do catálogo. O guard não executa reparos nem concede permissões.

### Limites explícitos
Esta checagem é **de metadados**, executada ao criar o runtime. Não verifica semanticamente corpos de funções, expressões de policies/CHECK/WHEN ou predicados de índices; não inventaria todos os objetos fora dos quatro schemas; não prova ausência de falhas no domínio; não monitoriza alterações posteriores ao boot; não resolve automaticamente `public.rls_auto_enable()`. Alguns tipos de objeto inesperados podem causar erro de consulta em vez de um relatório booleano, também bloqueando o boot. A consulta nova ainda precisa de execução e medição com PostgreSQL/driver/pooler reais. Um resultado positivo não substitui os testes de isolamento.

## 2. Integridade das migrations antes do SQL
`supabase/migrations.manifest.json` fixa versão candidata, nomes, ordem e SHA-256 dos oito arquivos anteriores. Todos continuam iguais aos da base 0.9.0.

```bash
npm run check:migrations
```

O comando verifica arquivos, não conecta ao banco e não reescreve o manifesto. A verificação também integra `npm run verify`, CI e o início de cada suíte SQL, antes de importar o driver.

O loader recusa arquivo alterado, faltante, extra, renomeado, vazio, link simbólico, tipo especial, ordem incorreta, duplicidade, travessia de diretório, UTF-8 inválido, manifesto fora do formato e limites excedidos. Limites: manifesto 64 KiB, arquivo SQL 2 MiB, 1–1000 entradas. As migrations são lidas uma vez; o SQL executado é o mesmo texto cujos bytes foram verificados, não uma segunda leitura do caminho.

**SHA-256 prova correspondência ao manifesto revisado, não segurança ou correção do SQL.** O manifesto não é assinado; quem puder alterar código e manifesto simultaneamente pode alterar a referência. Isso exige revisão Git e permissões de publicação. O loader não é um sandbox contra um administrador da máquina concorrente. Mudanças legítimas exigem nova migration e revisão explícita do manifesto, não regeneração automática para ocultar diferenças. A proteção por descritor/links foi testada no Linux deste ambiente; não se presume homologação de todos os sistemas operacionais.

## 3. Upgrade executável, ainda não executado
`supabase/tests/upgrade.test.ts` exige os alvos locais explícitos de teste antes de abrir conexão. Em PostgreSQL 17 descartável:

1. Recusa um banco `helpdesk_upgrade_test` já existente; nunca usa DROP para fazê-lo parecer novo.
2. Cria esse banco separado no mesmo cluster local de teste.
3. Aplica os bytes verificados das migrations 001–007 e exige schema 0.8.0 e ausência de assigned_to.
4. Insere fixtures sintéticas: conta, pessoas, vínculo, contrato publicado, cobertura, chamado, mensagem, nota interna, eventos, outbox pendente e resposta idempotente antiga sem assignedTo.
5. Captura as linhas antes da atualização, aplica somente 008 e compara as mesmas linhas, excluindo exclusivamente a coluna nova da comparação do ticket.
6. Exercita leitura/reenvio antigos, privacidade da nota, revogação efetiva, nova atribuição e preservação do snapshot contratual e da resposta de criação.

São **8 cenários de upgrade**. A suíte principal possui **111 cenários**, sendo 11 novos de alteração controlada de grants, policies, search_path e triggers. Esses testes aplicam o desvio no banco descartável, exigem recusa, restauram o objeto em finally e exigem prontidão novamente. Não tocam projeto Supabase remoto.

Docker/nativo e `npm run test:db` agora executam as duas suítes em série (`--test-concurrency=1`), compartilhando somente o cluster descartável e o papel de login. O encerramento do cluster pertence ao runner; a suíte fecha seus pools, mas não apaga bancos preexistentes. Execução manual deixa o banco de upgrade para inspeção. Uma nova rodada deve usar cluster novo.

**119 é a quantidade de testes SQL escritos, não aprovados.** A indisponibilidade de PostgreSQL impede a validação do SQL, grants, RLS, upgrade e restauração. O teste de upgrade não equivale a restore de backup, nem cobre todos os caminhos históricos de atualização.

## 4. Critérios de liberação preservados
Dependências e lock revisados → testes locais → PostgreSQL novo e upgrade → Auth/pooler/TLS/Functions → navegador → carga/backup/restauração/revisão operacional. `HELPDESK_RELEASE_APPROVED` permanece fechado. O piso agregado é 679 testes locais, 119 SQL e 53 HTTP/browser; contar os testes escritos ou simular metadados não satisfaz esses critérios.

## 5. Referências técnicas consultadas nesta rodada
Documentação oficial PostgreSQL 17, consultada em 16/09/2026 no fuso America/Sao_Paulo (logs podem ter data UTC de 17/09):
- https://www.postgresql.org/docs/17/functions-info.html — privilégios efetivos em tabela/coluna/função, grant option e expansão de ACL.
- https://www.postgresql.org/docs/17/catalog-pg-trigger.html — flags de habilitação, tipo e diferimento.
- https://www.postgresql.org/docs/17/catalog-pg-constraint.html — tipos e validação de constraints.

Essas referências explicam os metadados; não certificam o SQL candidato produzido aqui.
