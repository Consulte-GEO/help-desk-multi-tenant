# Consulte GEO Formulários publicados M09a

Incremento sobre M06, no mesmo PR31 draft. A jornada preparada apresenta as cinco ações de acesso de usuário, reutiliza formulários publicados e conecta os componentes aos handlers de rascunho, revisão e abertura existentes. A montagem operacional aguarda o catálogo autorizado, os stores de intake e a integração real M08; copiar os assets não libera atendimento.

## Formulários e confirmação

A escolha de ação é explícita. O painel fixa a versão selecionada e mostra campos da ação e horas úteis configuradas. Troca de ação exige descarte dos dados quando houver formulário em andamento. Salvamento, revisão, envio e confirmação desconhecida bloqueiam a troca; logout cancela operações e destrói controles. Respostas atrasadas não reaparecem em outra ação ou sessão.

O adapter usa a closure da sessão para acessar caminhos fixos, JSON limitado a262144bytes com prazo de consumo5s, If-Match e Idempotency-Key. Draft/conta/obras/formulário/versão e resultado de abertura/actor/requester/workspace/protocolo são conferidos. StatusHTTP, ETag, Location e replay também precisam corresponder ao recibo. Uma resposta incompatível preserva a mesma intenção para conciliação; não existe retry automático. Uma recusa tipada permite nova revisão. Notificação pending não significa envio ou entrega.

O rascunho preserva valores incompletos para correção. O servidor revalida formulário, escopo, coverage e evidências na revisão/abertura. O painel não atribui permissões ao grupo solicitado, não cria pessoa no GEO e não envia acesso. Sem lookup ou Storage qualificado, esses controles ficam indisponíveis.

## Privacidade e versões

A projeção valida o registro M04 integral, exige publicação e entrega somente descriptor público. Checklist, autoria administrativa, motivos, auditoria e campos internos não são serializados ao cliente. O parser compartilhado exige shape/versão/ação exatos e cópia imutável; não recompila uma versão publicada. Essa projeção é função pura, sem endpoint de leitura: seu chamador futuro precisa autorizar o registro pelo contexto real antes de usá-la.

O código não acrescenta routes, migrations ou dependências. API/interface0.28.0, schema0.21.0,14 migrations,97funções e26operações permanecem. As famílias publicadas de dúvidas, backup, implantação e problemas têm projeção compatível, mas a prova de jornada desta fatia cobre acesso de usuário.

## Fonte Novo GEO

O usuário indicou o [wiki Consulte GEO](https://github.com/Consulte-GEO/wiki_consultegeo). Onze documentos de engenharia na revisão `74d55052794723afb6d7eec91e11aa218012393c` foram inspecionados em modo somente leitura. [Qualificação documental M08](integrations/NOVO-GEO-WIKI-M08-2026-10-13.md) registra paths/linhas/hash, operações documentadas e divergências; não presume implantação, DTO completo ou aceite de identidade.

O wiki descreve OIDC, usuário local por tenant, grupos/material e obras, mas registra lookup por e-mail, seleção de tenant por header e divergências entre seletor e ACL. Nenhuma dessas informações foi convertida em grants ou manifest approved. Faltam revisão implantada dos repositórios técnicos, contrato DTO/erros/paginação, cliente Help Desk próprio e prova de autorização/revogação da origem.

## Verificação e revisão

Testes focais cobrem draft/corrupção/privacy/descriptor, escolha/descarte/clear e recibos de outra identidade/versão, headers contraditórios, limites e falhas ambíguas. Foram reproduzidos e corrigidos ordem de chaves JSONB, escolha assíncrona que não invalidava rascunho e adoção de escolha durante confirmação desconhecida. As suítes anteriores de formulário e intake continuam registradas.

Chromium próprio passou14verificações em1440/390 com publicação M04, handlers e domínio reais, mas Auth/origem/persistência física sintéticos. Demonstra salvamento e prévia sem ticket, uma abertura com confirmação perdida e replay do mesmo protocolo, indisponibilidade de lookup, limpeza e layout. A fixture acrescenta campo de impacto para a política C10 sintética; o mapping operacional de prioridade/produto/coverage continua M09b. Capturas são dados sintéticos; não comprovam banco ou origem reais.

[CI original38477579106](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38477579106) aprovou a fonte corrigida `e6263187850552a97af6b8a96f4b1cfa60cdc6e9`: **4.467 aplicação,390 PostgreSQL17 e206 interface —5.063 testes**, zero falhas/cancelamentos/skips/todo. Lock, instalação limpa, audit, types, contratos, migrations/upgrade e build passaram. Fingerprint `90ecba58d43cd16ae8e323d43f26ddbeb986f2ecefb2e2261e595e7d87556bd2`; relatório e seis logs importados sem alteração em `evidence/homologation`, hashes e check:homologation conferidos. [Metadata de origem](../evidence/consultegeo-m09a/ci-source.json) descreve preparação da fonte; `tests_executed:false` ali não representa os resultados da suíte.

[Revisão independente](../evidence/consultegeo-m09a/review-final.md): Critical0/Important3/Minor0 na fonte378dca2. Os três Important foram reproduzidos e corrigidos em um único fix pass: recusa na conciliação conserva unknown/key/payload; composição com createSessionFetch elimina o prefixo duplicado; ocultar/reexibir campo invalida escolhas anteriores de pessoa/arquivo. Cinco regressões RED→GREEN;73focais e14browser verdes. A fonte anterior teve CI verde, mas a qualificação final usa somente a fonte corrigida e626318.

Decisão: adiamentos M08/M09b/Storage/e-mail permanecem porque contratos/instalação operacionais não foram qualificados; custo é não oferecer intake hospedado ou entrega real nesta fatia. Decisão: executar M09a independente da confirmação de M08 para preparar a jornada; a dependência live segue explícita. Decisão: adaptar helpers bash da skill ao ledger Windows após falha MSYS no sandbox; custo é registrar comandos/resultados diretamente, com CI Linux integral verificável. Não há Minor adiado.

## Continuidade

M08: cliente/identidade/contexto/obras e publicação privada de snapshots reais. M09b: catálogo autorizado, mapping dos artefatos M04 para IntakeProfile, stores de rascunho/abertura e montagem dessa jornada. M10: cliente/N1 sobre workflow/checklist publicados. M11: Storage/scan, execução de SLA e Resend worker/webhook/entrega. M12: piloto e aceite hospedado.

Nesta etapa não houve alteração hospedada de Auth/grants/segredos, migration, registro GlobalCad, criação de usuário GEO, envio, merge ou deploy de produção. PR31 permanece draft e atendimento fechado.
