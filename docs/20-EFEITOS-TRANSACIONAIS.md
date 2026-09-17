# Help Desk v0.16.0 — R14-06 / efeitos transacionais

**Entrega local. API e schema candidato 0.16.0. Não publicado.** A implementação trata a pendência R14-06 da revisão: a aplicação já escrevia evento/outbox na mesma transação, mas nem toda gravação direta tinha uma exigência correspondente no banco. A migration 010 ainda não foi executada: este documento descreve código candidato, não um banco homologado.

## 1. Escopo e regra

| Escrita nova | Evento funcional obrigatório | Intenção externa |
|---|---|---|
| Criação do chamado | ticket.created, versão inicial 1 | Obrigatória |
| Resposta pública | message.created, ID e tipo de autor correspondentes | Obrigatória |
| Nota interna | note.created, ID da nota e autoria correspondentes | Proibida |
| Mudança de situação | ticket.status_changed, estados anterior e novo | Obrigatória |
| Mudança de prioridade | ticket.priority_changed, valores e versão | Obrigatória |
| Assumir/liberar atendimento | ticket.assignment_changed, ação e responsável anterior/novo | Proibida |

Ações sem alteração efetiva e reenvios idênticos não geram nova escrita funcional, evento ou registro de efeitos. A resposta idempotente continua sendo o snapshot original, sujeito à autorização e validação atuais; não se torna uma consulta ao estado atual.

Não há envio de e-mail/webhook. Outbox continua sendo intenção de entrega futura. A mudança não implementa dispatcher, SLA, filas completas, participantes, anexos ou backoffice M2.

## 2. Desenho adotado nesta implementação

Foi acrescentada `helpdesk_audit.write_effects`, uma tabela privada com registros produzidos pelos triggers de gravação. O runtime não recebe SELECT/INSERT/UPDATE/DELETE ou helper de administração sobre ela. Não existem policies de leitura ao app ou às roles cliente; RLS e FORCE RLS ficam habilitadas.

O registro captura workspace, conta, chamado, ator, tipo da escrita, versão, identificador da mensagem/nota quando aplicável, identificador da transação, metadados esperados e vínculo com o evento. Não copia corpo de mensagem, descrição ou motivo interno. Ainda contém identificadores pessoais/de recursos, portanto não é dado anônimo e precisa entrar na governança.

Sequência candidata:

1. Uma gravação real produz o registro privado. O servidor HTTP não o insere.
2. A mensagem pública é registrada antes de avançar a versão do chamado. Esse avanço marca o efeito como aplicado. Uma nota não avança a versão.
3. O evento precisa corresponder a uma escrita aplicada desta mesma transação: recurso, ator, tipo, dados e visibilidade. Evento órfão ou reaproveitado é recusado.
4. A outbox precisa usar o mesmo evento e a versão vinculada. Só aceita envelope mínimo, tipo, instante e IDs coerentes. Motivos/corpos não são aceitos no payload externo.
5. O trigger diferido lê a versão final do registro de efeitos e exige todos os pares antes do COMMIT. Operações privadas não podem ter outbox correspondente.

O ID é obtido pelo PostgreSQL com `pg_current_xact_id()` (`xid8`), não de um header/GUC controlado pelo cliente e não de `xmin`. A documentação do PostgreSQL informa que essa função retorna o ID da transação principal mesmo em subtransações. Triggers de constraint podem ter verificação adiada até o final da transação. Essas referências embasam o desenho; não são evidência de execução deste SQL.

Fontes técnicas consultadas em 17/09/2026:
- PostgreSQL 17 — CREATE TRIGGER: https://www.postgresql.org/docs/17/sql-createtrigger.html
- PostgreSQL 17 — System Information Functions, pg_current_xact_id: https://www.postgresql.org/docs/17/functions-info.html

As alternativas examinadas foram manter somente os testes de serviço ou conferir apenas a existência de algum evento. A segunda permitiria que um evento histórico satisfizesse uma gravação nova. O registro ligado à escrita real e à transação foi escolhido para evitar essa ambiguidade. O custo é uma linha e índices adicionais por alteração efetiva, mais trabalho no COMMIT; nenhuma meta de latência/escala foi medida.

## 3. Limites preservados

- Autorização continua dependendo de identidade, vínculo, papel, escopo e recurso. Um registro de efeitos não concede acesso.
- As policies e os guards anteriores permanecem. Os novos binders conferem o acesso ao chamado antes da consulta privada e não expõem dados da tabela de efeitos.
- Os eventos de notas e atribuição continuam internos. As projeções públicas existentes não foram ampliadas.
- A API mantém 18 operações/14 caminhos. Nenhum endpoint novo, dependência, configuração de Auth ou permissão de provisionamento foi adicionado.
- A mudança de situação não recalcula SLA. Responsabilidade não muda acesso. Contrato/snapshot continuam imutáveis.
- O modelo de memória valida somente o conjunto de escritas realizado por seu Store. Não é uma emulação de triggers, roles, locks ou isolamento PostgreSQL, nem uma defesa contra um adaptador inteiramente comprometido.

## 4. Legado, manutenção e crescimento

As migrations 001–009 permanecem byte a byte iguais à v0.15.0. A migration 010 exige schema 0.15.0 e owner administrativo aprovado, cria o novo objeto e passa a anunciar 0.16.0. Não executa backfill de efeitos nem reescreve eventos, caches, mensagens ou snapshots históricos.

Isso é intencional: não se cria uma falsa certificação retroativa. A integridade dos registros anteriores precisa de auditoria própria. O ensaio de upgrade mantém as fronteiras 0.8 → 0.9 → 0.15 e acrescenta 0.15 → 0.16, verificando preservação dos dados sintéticos e criação de efeitos apenas nas operações posteriores.

Não foi implementado expurgo da tabela privada. A rotina de limpeza de dados efêmeros não foi ampliada para removê-la. Definir retenção, acesso operacional, arquivamento e backup/restore antes de dados reais. A expectativa é uma linha por criação/mensagem/nota/transição/prioridade/atribuição efetiva; leituras, replay e no-op não adicionam linhas.

As restrições dependem de triggers habilitados, roles restritas e contexto definido pelo backend confiável. Não constituem WORM, assinatura de histórico ou defesa contra administrador do banco comprometido. A verificação de inicialização observa metadados; não prova os corpos de funções nem monitora mudanças futuras continuamente.

## 5. Erros e resultados incertos

O adaptador de memória recusa efeitos ausentes/incompatíveis com `503 transaction_effect_mismatch`; o estado clonado, inclusive o cache, não é confirmado. Três testes de socket confirmam ausência de sucesso parcial, erro sem conteúdo privado e reenvio explícito com a mesma chave depois de remover a falha controlada.

O banco candidato utiliza erros de integridade/autorização. O executor PostgreSQL existente é conservador: qualquer erro depois de solicitar COMMIT é apresentado como `transaction_outcome_unknown`, com descarte da conexão, sem retry automático. Um teste local com resposta controlada de rejeição diferida confirma esse contrato. A expectativa de um teste SQL anterior foi alinhada a esse comportamento, preservando a obrigação de recusa e a verificação de rollback; não se alegou que esse teste SQL tenha sido executado.

Nunca concluir que um erro de rede após COMMIT prova ausência de gravação. Consultar o recurso/recibo ou repetir explicitamente a mesma chave e conteúdo, conforme a operação. A nova proteção não elimina essa janela de confirmação.

## 6. Verificações ainda necessárias

Executar fresh install com as dez migrations e upgrade em banco descartável separado. São 179 cenários escritos (165 principais +14 de upgrade), incluindo omissão silenciosa, corrupção, eventos antigos, SQL direto, privacidade, savepoint, múltiplos comandos e trigger desabilitado. Ainda não há resultado SQL aprovado.

Homologar o plano das consultas dos binders, espera de locks, concorrência real, COMMIT/ROLLBACK e desempenho em volume representativo. Testar explicitamente o perfil que escreve notas sem ler a coleção, assinatura de funções/privilégios, migração sem alterações nos snapshots e ausência de vazamento em logs/erros. Depois homologar driver/Functions/Auth/pooler/TLS e navegador. M1 permanece aberto.
