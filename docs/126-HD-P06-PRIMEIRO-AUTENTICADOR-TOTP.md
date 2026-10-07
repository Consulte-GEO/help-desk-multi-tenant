# HD-P06 — configurar o primeiro autenticador da própria conta

A entrada TOTP já estava publicada, mas a própria pessoa ainda não conseguia configurar o primeiro fator pela interface. Esta fatia oferece cadastro opcional depois de `/me`, inclusive com atendimento bloqueado, usando chave manual e confirmação por código do aplicativo.

Abrir o diálogo não cria nada. **Preparar meu autenticador** consulta primeiro Auth `/user` com bearer atual, valida a identidade exata e o catálogo completo limitado. Qualquer fator verificado recusa esta etapa de primeiro cadastro. Havendo TOTP não verificado, a interface permite confirmar esse fator sem criar outro ou devolver a chave anterior. Sem TOTP pendente, o transporte envia um POST `/factors` com tipo totp, issuer/friendly_name fixos e nenhum destinatário, ID de outra pessoa, papel ou scope.

A resposta só entrega a chave manual se ID/tipo/secret forem compatíveis. A chave é limitada a16–128 caracteres Base32 e apresentada por textContent. SVG/QR/URI retornados pelo provedor são descartados e não executados. Não há clipboard automático, storage, logs de chave, nem publicação desse valor no estado observável da sessão. O promise retido pela sessão é substituído depois da entrega à tela; a chave não continua necessária em memória para confirmar o código.

`enrolling_mfa` bloqueia novas requisições, refresh, senha e cadastro duplicado no mesmo contexto. A barreira existente de despacho também cobre pedidos iniciados no mesmo turno. Fator e código precisam pertencer às opções pendentes desta intenção. Wrong-code/rate-limit aceitam apenas tentativa explícita; confirmação válida usa a validação existente de mesma pessoa/AAL2 e termina com logout local e nova entrada. Não instala o bearer elevado no workspace antigo nem concede administração.

Cancelamento,401 atrasado e resposta perdida mantêm o dono da operação até o request e logout terminarem. A chave e o código são removidos do DOM antes de outra entrada. Cancelar antes de preparar preserva o rascunho; depois de preparar, encerra o contexto e informa o estado pendente possível. Falha de geração/verificação não vira sucesso e não é repetida automaticamente. Resposta incompleta de verify usa o canal privado de cleanup já existente, sem expor bearer no erro/estado.

## Fatores pendentes e limites

Nenhum fator é apagado, desativado ou resetado automaticamente. Fechar durante um cadastro pode deixar fator não verificado no provedor. Se o aplicativo já foi configurado, uma nova entrada pode retomar a confirmação desse fator. Se a chave foi perdida antes disso, será necessária revisão no provedor; esta entrega não inventa recuperação nem cria outra matrícula sobre o pendente.

O pre-read evita criação sobre fatores já vistos, mas não é uma transação global entre abas. A serialização desta entrega é da própria sessão; não declarar exclusividade global ou entrega exatamente uma vez. Gerenciamento de fatores adicionais, recuperação, remoção segura de abandonados, QR e matrícula administrativa obrigatória seguem pendentes.

Decisões: usar chave manual sem renderizar SVG/QR/URI, exigindo cadastro manual no aplicativo; não remover/resetar fatores e retomar pendentes por confirmação, com revisão externa necessária se a chave se perdeu. A política do [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp) e sua [implementação de enrollment/verify](https://github.com/supabase/auth/blob/master/internal/api/mfa.go) continuam determinando aceitação, limites e AAL. Não há alteração de configuração do provedor ou dos escopos atuais.

API/interface0.22.0, schema0.19.0,12 migrations,25 tabelas e19 operações. Atendimento fechado e M1 operacional aberto. Nenhum fator, OTP, senha ou configuração real foi exercitado/alterado durante o desenvolvimento. O usuário habilitará a própria conta somente quando acionar o fluxo autenticado e confirmar no aplicativo.

## Verificação

RED: nove testes Node falharam pela ausência de enrollment; browser falhou pela ausência do botão. GREEN:9 testes novos,27 focais com login/transporte MFA e32 cenários de sessão humana no navegador. Cobertura: usuário/catálogo incorretos antes do POST, fator verificado recusado, pendente retomado, payload estrito, chave/resposta inválida, falha sem retry, estado sem segredo, despacho bloqueado, code/ownership, cancelamento e401 tardio com cleanup.

Revisão independente sem achados críticos/importantes/menores. O revisor verificou nove novos testes; cinco casos HTTP em loopback ficaram impedidos por EACCES do sandbox dele, confirmado por probe independente. A execução integral apta continua sendo requisito separado. Exclusividade entre abas e aceite real do provedor foram explicitamente deixados fora das evidências sintéticas.

Windows1609/1586/23 conserva as falhas conhecidas da plataforma. Interface completa106/106 aprovada (35HTTP,39 browser de memória,32 sessão humana). Typecheck/contratos/migrations/lock/scan/build passaram. CI Linux [37679284709](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37679284709) aprovado:1609/1609 aplicação,229/229 PostgreSQL e106/106 interface, zero falhas/skips. Lock, instalação limpa, audit, typecheck, contratos, migrations, scan e build aprovados. Artefato11508187598, SHA256 `3b788449f4ba95f38b5c23716ec5719f096268069746cb8ed06cd585e44cdc98`; fonte CI `fc3e1ffdf44aceb0b1548a5fa0f37c1b2e587797`, fingerprint `93d1c159c0022f43e43476860d325981c9c6d99f02507c6ee1ff93302ed8cfb2`. Arquivo e seis logs verificados antes de copiar para `evidence/totp-enrollment/ci-green` e evidência canônica. Publicação pendente. SMTP, enrollment/OTP reais, recovery, demais fatores e administração ainda precisam de aceite próprio.
