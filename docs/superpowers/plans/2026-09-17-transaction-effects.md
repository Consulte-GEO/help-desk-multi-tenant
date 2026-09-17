# R14-06 — Efeitos transacionais / plano v0.16.0

Objetivo: toda nova escrita do núcleo atual deve ter exatamente o evento correspondente e, somente para operações públicas, sua intenção mínima de notificação. Continuar M1 sem declarar homologação de banco.

## Decisão
Um registro privado de efeitos por escrita é gerado por triggers, não pelo cliente ou pelo serviço HTTP. Captura ator, recurso, versão, tipo, transação e valores não textuais necessários à conferência; não duplica corpos/motivos. Eventos e outbox são vinculados na mesma transação. Verificação diferida impede COMMIT incompleto. Registros legados não são reescritos nem retroativamente certificados.

Alternativas examinadas: somente testes no serviço (não cobre SQL direto); conferir apenas existência de evento (permite reutilizar histórico); registro privado produzido pelo banco (escolhido, acrescenta uma linha/índices por escrita e exige medição real).

## Escopo fechado
Criar chamado, mensagem pública, nota, transição, prioridade e atribuição. Não altera API, estados, contratos, SLA ou canais. Nota/atribuição jamais geram outbox externo. Retry não cria registro novo. Sem efeito remoto.

## Execução
- [x] Recuperar bundle0.15 e reproduzir905 testes; registry indisponível no diagnóstico inicial.
- [x] Escrever e executar testes negativos de gravação sem evento/outbox e efeitos órfãos no adaptador local.
- [x] Implementar modelo de referência de efeitos e integrá-lo ao COMMIT em memória.
- [x] Migration010 privada com registro, validação de evento/outbox e constraint trigger diferido; preservar001–009.
- [x] Atualizar inventário/metadados/hash/versionamento; escrever cenáriosSQL positivos, negativos e upgrade.
- [x] Executar verificações possíveis; registrar banco/browser/dependências bloqueados sem convertê-los em aprovação.
- [x] Revisar diff, preparar pacote completo, patch, bundle e handoff.

Limites: testes do modelo não executam PL/pgSQL. pg_current_xact_id representa transação, não identidade. Proteção exige triggers habilitados, login restrito e contexto colocado pelo backend confiável. Administrador comprometido permanece fora dessa garantia. Registro de intenção não significa notificação entregue. Nenhum automatismo de repair, delete ou backfill do histórico.

**Fechamento local:** implementação e evidências preparadas; verificações possíveis executadas. Nenhum item marcado indica PostgreSQL, browser, implantação ou produção aprovados. Ver docs04 e20.
