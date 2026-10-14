# Consulte GEO — catálogo e rascunhos M09b

M09b desenvolvido e homologado no PR31 draft. A entrega qualifica catálogo e rascunhos duráveis. A abertura completa segue em M09c. O incremento permanece em desenvolvimento; não houve instalação ou publicação em produção.

## Comportamento

O catálogo verifica a pessoa, a conta e todas as obras no resolver da origem e no PostgreSQL antes de fornecer os formulários públicos. O produto vem da conexão CG e o serviço corresponde à família M04. A última versão publicada aparece no catálogo; uma sucessora em rascunho não substitui a publicada. Rascunhos de atendimento mantêm a versão original publicada.

A própria pessoa pode salvar respostas incompletas e retomar um rascunho por 30 minutos. Dono, conta, obras, formulário, versão e expiração ficam fixados. If-Match protege alterações concorrentes; repetir a mesma intenção não duplica revisão ou auditoria. Salvar não significa validar para envio. As duas tabelas privadas têm ENABLE/FORCE RLS e nenhum acesso direto da aplicação, dos clientes, do publicador ou do worker. Helpers limitados verificam autorização atual e conjunto completo de recursos. Gravação e auditoria são atômicas; efeito suprimido ou validação obrigatória inválida força rollback.

Operações opcionais:

- POST /v1/consultegeo/request-catalog.
- GET /v1/form-drafts/{draft_id}.
- PUT /v1/form-drafts/{draft_id}.

As operações exigem origem HTTPS exata, autenticação/MFA, limites, taxa e admissão até o COMMIT. HELPDESK_CONSULTEGEO_INTAKE continua false e exige liberação do atendimento, workflow, origem e portas reais de servidor. A entrada Netlify ainda não possui adaptador M08 qualificado. O envio permanece fechado, sem fallback legado. A UI M09a ainda não foi montada na aplicação.

API/interface 0.29.0, schema candidato 0.22.0, quinze migrations. Os quatorze arquivos anteriores e os seis candidatos M05 foram preservados. Contrato revisado: 50 tabelas, 112 helpers, 42 triggers, 269 constraints incluindo o constraint trigger e 38 policies. A nova migração foi criada pelo Supabase CLI 2.120.0. Nenhuma permissão, identidade, credencial ou configuração hospedada foi alterada.

## Validação e evidência

O [CI original 38493917973](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38493917973) aprovou **4.487 testes de aplicação, 403 de PostgreSQL 17 e 206 de interface: 5.096 testes**, sem falhas, cancelamentos ou testes ignorados. Instalação limpa, lockfile, auditoria, tipos, contratos, segredos e build também passaram. O inventário nativo coincide com o contrato estático revisado; a ordem física das colunas UPDATE foi comparada como conjunto, preservando o prefixo revisado.

- Fonte qualificada: `b4a6c9012463d3709e51a9b17efe68997a7b2d7a`.
- Fingerprint: `5b6636ac227107636829b2d93d4b4f89cb8a2c3fc6945d2216d12768c4386233`.
- Relatório canônico: evidence/homologation/latest.json; seis logs originais em runs/fe9e9564-79e2-411d-bd95-9b77e2f16b39, conferidos por SHA256 e pelo validador original antes da importação.
- Fonte do CI e inventário: evidence/consultegeo-m09b/ci-source.json e security-inventory.json.

As tentativas anteriores foram preservadas em regressions. CI38487888076 detectou sentinelas antigas e ambiguidade UUID/text no preparo sintético (aplicação4486/4485/1, PG237/229/8). CI38488705283 detectou42P01 na qualificação de variável e22P02 na passagem direta de array JS ao parâmetro JSONB (aplicação4487/4487, PG403/393/10, UI206/206). CI38489675294 detectou42703 em uma referência restante de binding (PG403/394/9). Esses resultados não foram adotados como homologação. As causas foram corrigidas sem modificar os gates originais.

A suíte completa Windows registrou4484/4372/112, zero skip/cancel, com falhas de sockets, symlinks e TLS sob sandbox, além da sentinela de contagem corrigida. Os112 nomes constam íntegros em windows-failures.json. A homologação canônica é exclusivamente o CI original integral Linux/PG17 após as correções.

Uma revisão independente do conjunto encontrou duas Important: retomada após refresh selecionava observação histórica e403 mfa_required virava503. Ambas corrigidas na rodada única. A regressão HTTP foi observada RED→GREEN. A regressão nativa conserva duas observações e executa a definição anterior do directory dentro de transação descartada, demonstrando HDI01; após rollback, a função atual retoma o mesmo rascunho. O banco também recusa coerção do ID numérico5 quando a permissão é para a string5. Detalhes em review-final.md. Sem Critical ou Minor; não houve segunda revisão.

As fontes externas e os dados de teste são sintéticos. Resolver, transportes, pool restrito, stores, serviços e PostgreSQL são reais. Esse ensaio não comprova autenticação ou permissões do Novo GEO real e não autoriza publicação hospedada.

## Continuidade

M09c implementará protocolo por workspace, snapshot privado fixado, referências CG seladas, estado inicial, core event/audit/outbox e recibo/reconciliação na mesma transação. O perfil M04 já fornece prioridade e SLA fixos. A primeira abertura a qualificar será Incluir usuário. Lookup e arquivo exigem fontes M08/M11; implantação continua somente por planilha. Não houve envio de email, teste Resend real, upload ou escrita no GEO neste incremento.

O wiki indicado permanece evidência documental. Repositórios, DTOs, discovery, IdP, client, audience e callback precisam de qualificação; não se associa identidade por email ou nome. M10 atenderá a jornada, M11 a operação de SLA e worker Resend e M12 o piloto.

## Decisões e custos

1. Produto da conexão e serviço M04 determinísticos: evita outro cadastro de associação; custo: serviços/coberturas da família precisam estar configurados, sem inferência de SUPPORT.
2. Primeira abertura futura será Incluir usuário; lookup/arquivo exigem fonte qualificada: custo: outras ações com evidência aguardam M08/M11.
3. Registro de progresso por ferramentas nativas Windows após falha MSYS: custo: registro manual; CI independente verifica o código.
4. M09b entrega catálogo/rascunho e M09c a abertura completa: custo: nova qualificação antes do envio.
5. Limites não julgados pelo revisor permanecem explícitos: M09c, instalação hospedada, fonte M08 e montagem da UI; custo: atendimento/envio continuam indisponíveis até os blocos correspondentes.

Nenhum minor adiado. PR31 permanece draft; sem merge, deploy ou aplicação remota de migrations.
