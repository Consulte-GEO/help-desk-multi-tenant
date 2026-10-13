# Consulte GEO M04 configuração e publicação

Thiago autorizou desenvolver M04 nesta conversa, mantendo as decisões já delegadas de produto, SLA, acesso, reabertura e implantação. A direção é Consulte GEO. A execução segue inline; as decisões de implementação abaixo concretizam o recorte aprovado, sem nova rodada de autorização. A abordagem é arquitetural: um conjunto publicado consistente por família de serviço, reutilizando os validadores existentes.

## Resultado

Administradora Consulte com MFA verificado e capability explícita salva um rascunho, confere os formulários por ação, workflow, checklist e SLA, publica e consulta autoria/data/versão. O servidor valida todo o conjunto e os handlers qualificados na mesma transação. Novas alterações criam versão sucessora; versões publicadas e snapshots não são reescritos. Publicação não concede permissão de obra/pessoa nem ativa o atendimento.

Famílias: acesso de usuário (incluir, alterar, desativar, reenviar acesso e liberar obra), dúvidas, backup, nova obra, ajuste de estrutura e problemas (quatro prioridades). Templates de produto são rascunhos editáveis, sem criação automática de registros. SLA e horário partem da política M02/M03; calendário exige horizonte de até 366 dias e feriados explícitos, inclusive lista vazia decidida pelo publicador. Converter 08h–18h America/Sao_Paulo em intervalos UTC sem assumir offset; SQL confere a compilação com sua própria zona.

## Contratos

Definição v1 por família: ID UUID, versão, serviço, título, calendário local e entradas por ação/prioridade; cada entrada contém schema de formulário draft, checklist draft, prazo de primeira resposta/solução e janela de reabertura. Compilação produz formulários/checklists published, perfil M02 com referência/hash do checklist, calendário e metas SLA em microssegundos. O workflow mantém a máquina já implementada: apenas a janela e o checklist são configuração; não anunciar um editor de transições arbitrárias.

O editor reutiliza o renderer dinâmico. Campos publicáveis desta etapa são text/textarea/boolean/select/lookup/file/info/download, suficientes para o recorte Consulte. Outros tipos continuam no validador geral mas não são anunciados neste publicador. Lookup/download/anexos exigem registry privado qualificado. Implantação usa política XLSX/CSV de 15 MiB; Storage/scan seguem M11. Orientações são texto, sem HTML executável. Dados de beneficiário não autorizam acesso.

## Persistência e autorização

Novo store transacional restrito, com read/admin/capability vivos, CAS de catálogo e entidade, receipt/audit append-only e proteção das versões published. SQL candidato no runner PG17 instala após M02, com guards helpdesk_test/superuser/opt-in. Uma tabela privada de capabilities M04, provisionada apenas pelo operador privado, alimenta o contrato AdminWorkspace existente; não há self-grant nem promoção de pessoas. HTTP exige VerifiedAdministrativeAssurance, origem, ETag, Idempotency-Key e limite de corpo. SQL revalida admin ativo e capability, não confia em proof/grants vindos do corpo.

Save/publish/restore são comandos nomeados. Restore clona conteúdo de published em draft de versão sucessora. Commit e ACK são validados; falha de confirmação mantém resultado desconhecido e conciliação da mesma intenção. SQL direto também valida definição, registry, artefatos derivados e hash; o JSON não seleciona tabelas ou funções. Publisher grava workflow/checklist M02 e conjunto de configuração atomicamente. O leitor de binding retorna versão/hash/artefatos exatos para intake futuro, nunca latest para um chamado existente.

## Aceite e limites

Testes negativos primeiro para versão/identidade/CAS/replay/imutabilidade/calendário/registry/MFA/capability/erro privado. PostgreSQL17 real cobre autorização, publicação, artifacts/hash, rollback e concorrência. Editor/HTTP são composições opcionais, testadas localmente; montagem do runtime M06, migration/upgrade M05 e aceite hospedado não fazem parte de M04. Gate/segredos/produção permanecem como estão. Revisão independente do delta M04 ao fim.
