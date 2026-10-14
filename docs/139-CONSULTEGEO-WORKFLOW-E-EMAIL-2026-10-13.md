# Consulte GEO workflow e comunicação do Help Desk

> Checkpoint M02/M03 preservado. A configuração/publicação M04 foi desenvolvida na mesma branch; consulte o [relatório M04](140-CONSULTEGEO-CONFIGURACAO-M04-2026-10-13.md) para o estado mais recente. As contagens e pendências abaixo descrevem este checkpoint anterior.

Data: 13/10/2026. Base: `604478e2d05ed019baac6d92a9a04db236fafb82`. Branch: `codex/consultegeo-m02`. O incremento desenvolve o writer PostgreSQL M02, compatibilidades M03, política operacional Consulte GEO e o transporte Resend com a identidade do Email Kit fornecido. Instalação hospedada e atendimento operacional continuam nas etapas seguintes.

Código para revisão: [PR31 em draft](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/31), direcionado a `codex/m1-reproducibilidade`. O fechamento documental não muda o fingerprint da fonte homologada.

## Decisões de produto

O desenvolvimento atende à Consulte GEO. Novas abstrações para vender o produto a outras empresas não são prioridade. Os conceitos existentes de cliente, contrato e obra permanecem porque delimitam acesso e cobertura dos chamados da Consulte GEO.

| Decisão delegada | Implementação nesta etapa |
|---|---|
| Provedor | Canal Resend sobre a máquina de entrega e o outbox existentes |
| Remetente | Configuração privada explícita; endereço e domínio verificado ainda necessários antes do envio real |
| Modelo de e-mail | Marca Consulte GEO, protocolo, explicação curta e um CTA para o portal autenticado |
| Ações de usuário | Incluir, alterar, desativar, reenviar acesso e liberar em nova obra; execução humana no GEO |
| Perfis | Solicitante, gestor do cliente, equipe Consulte e administrador Consulte, usando os papéis existentes |
| Reabertura | Motivo obrigatório e sete dias corridos desde resolução/fechamento correspondente |
| Transferência | Atendente ativo e operador da conta, acesso integral aos recursos, motivo e revalidação transacional |
| Implantação | Somente XLSX ou CSV, até 15 MiB por arquivo; sem DWG/XLS/macros |

O horário adotado é segunda a sexta, 08h–18h, America/Sao_Paulo; um dia útil tem dez horas de atendimento. Feriados precisam de um calendário publicado e versionado. Os valores abaixo são política de produto preparada para publicação; o relógio e os vencimentos ainda serão montados em M11.

| Serviço ou prioridade | Primeira resposta | Solução |
|---|---:|---:|
| Cadastro/liberação de usuário e dúvidas | 4 horas úteis | 10 horas úteis |
| Backup | 4 horas úteis | 30 horas úteis |
| Implantação nova obra | 8 horas úteis | 70 horas úteis |
| Ajuste de estrutura | 4 horas úteis | 30 horas úteis |
| Problema urgente | 1 hora útil | 10 horas úteis |
| Problema alto | 2 horas úteis | 10 horas úteis |
| Problema normal | 4 horas úteis | 10 horas úteis |
| Problema baixo | 8 horas úteis | 30 horas úteis |

Backup adota três dias úteis para preparação e conferência, resolvendo a divergência observada entre FAQ e formulário. O recebimento completo inicia o SLA; espera do cliente pausa solução. Encaminhamento e reabertura conservam consumo e violações. Aprovação pendente impede comandos de atendimento, salvo cancelamento autorizado. O vínculo ao calendário e o cálculo efetivo seguem M04/M11, sem prazo fictício por ausência de configuração.

## Workflow persistido

O writer usa a mesma transação para ticket, perfil, recursos, checklist, decisão, evento core, efeito, outbox e recibo. O hash de intenção é conferido também no SQL. Replay conserva a resposta original e não cria efeito adicional; revisão concorrente, comando divergente ou envelope incompleto recusam a confirmação.

O candidato protege as entradas antigas inclusive quando somente versão ou mensagem muda. Uma GUC isolada não autoriza o comando: ticket vinculado exige ledger privado da mesma transação, ator, revisão e evento. Os tickets antigos sem perfil continuam no fluxo anterior. Resolução exige checklist vinculado concluído; a revisão geral ainda invalida marcas após mudanças no ticket, exigindo reconferência. Separar revisão de execução permanece futura decisão de schema, sem aproveitamento automático de marcas antigas.

O retorno do solicitante de aguardando cliente retoma atendimento sem perder responsável. Reabertura usa o relógio do banco para elegibilidade, impedindo retrodatação do pedido. Transferência mantém o status e produz evento privado de atribuição, sem outbox externo nem concessão de acesso ao destino. O serializer e a timeline apresentam esse evento sem divulgar sua identidade em DTO público.

O SQL permanece candidato no runner PostgreSQL 17 descartável. Não foi convertido em migration hospedada, e as doze migrations anteriores permanecem intactas. API/interface 0.27.0 e schema esperado 0.19.0 permanecem os publicados.

## Comunicação e reuso do GeoLab

O reaproveitamento mantém os contratos próprios do Help Desk. Foram adaptados o padrão de requisição Resend, validação de aceite, proteção de segredos, tratamento de confirmação incerta e HTML/texto da identidade Consulte GEO. A referência GeoLab é v4.115, `7941b93fb521d88a7cfac0d51520229c7d77eaa6`, auditada em `Entregas/Auditoria_Operacao_V5_2026-10-13/GEOLAB_EMAIL_REUSO.md` na pasta de trabalho. Provisionamento de laboratório, senhas temporárias, papéis e payloads de laudos não compõem o novo canal.

`createResendNotificationChannel` implementa `NotificationChannel`; o dispatcher existente continua responsável por audiência, ACL, lease, identidade durável e tentativas. A chamada usa endpoint fixo, sinal de cancelamento, corpo limitado, uma pessoa por requisição e a mesma Idempotency-Key. Não há SDK novo, retry interno, CC, anexos ou credenciais nos erros.

Aceite exige HTTP bem-sucedido e ACK nativo com ID UUID válido. Resposta contraditória, timeout, falha de rede, 5xx, conflito de idempotência ou ACK inválido deixam o resultado desconhecido. Rejeição tipada de rate limit pode permitir nova tentativa pelo ledger; erro conhecido de configuração/validação é não aceitação sem retry. `lookup` exige uma fonte de evidência correlacionada; sem ela retorna ausência de prova. Aceite pelo provedor não significa entrega.

A janela de idempotência de 24 horas do Resend não autoriza reenviar um resultado desconhecido após esse período. Webhook autenticado, dedupe/ordenação, prova de entrega/bounce/complaint, worker e persistência do canal ainda pertencem a M11 E2–E5. Referências oficiais: [envio](https://resend.com/docs/api-reference/emails/send-email), [idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys), [webhooks](https://resend.com/docs/dashboard/webhooks/introduction).

Os três modelos preparados são recebimento, pedido de complemento e solução registrada. Os modelos conservam status draft; as prévias usam publicação sintética exclusivamente para renderização. O renderer valida versão/hash, usa somente protocolo como substituição e escapa HTML. Não inclui nome, e-mail, obra, formulário, nota, checklist ou devolutiva integral.

O Email Kit foi usado como referência visual: 600 px, tabelas, fontes de sistema, fundo claro, cabeçalho Consulte GEO e botão mínimo de 44 px. Não foram adotados scripts do anexo, endereço jurídico fictício, logo remoto sem origem qualificada ou links de preferências inexistentes. As seis prévias Chromium, em 1440 px e 390 px, têm um link e zero overflow horizontal. Essa inspeção não substitui teste em clientes de e-mail reais.

## Validação

CI integral aprovado na fonte `dac32bef6e116f499cf9edc1544ceccf69d1bc6b`, [run 38429609998](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38429609998): **4.318/4.318 aplicação, 355/355 PostgreSQL 17 e 168/168 interface**, zero falhas, cancelamentos, skips ou todo. Lock, instalação limpa, audit, doze migrations, tipos, dezenove operações/contratos, scan heurístico de segredos e build passaram no workflow original Linux/Node22. A suíte de banco inclui os 28 cenários novos do incremento e seu teste pai.

Fingerprint de fonte: `024153e3155f43ebc4639c6304566036c4c49768c7b71d89094dcf556076fe91`. O relatório e os seis logs dessa mesma execução foram importados em `evidence/homologation`; `npm run check:homologation` validou fonte, hashes, contagens e estrutura no Windows. A origem CI está em `evidence/consultegeo-m02/ci-source.json`; `tests_executed:false` ali descreve somente a etapa de preparação da fonte. O resultado dos testes está no relatório de homologação. Esta prova não equivale ao aceite Supabase/Netlify ou ao envio operacional.

Na fonte corrente, 122 testes focais, typecheck e build locais passaram. A revisão independente revalidou 220 testes sem falhas/skips e não identificou Critical/Important restantes após as correções. Foram corrigidos acesso do destinatário da transferência, prazo de reabertura pelo relógio do banco e contrato do histórico de transferência. Regressões adicionais de Resend recusam configuração vazia e ACK contraditório/não tipado.

As execuções anteriores documentam desenvolvimento, não aprovação: o primeiro CI apontou erro de sintaxe no candidato recebido; o segundo passou 4.312 testes de aplicação e 168 de interface, mas falhou na preparação de chamados após a proteção de recursos. A preparação agora usa chamados existentes criados antes do vínculo, mantendo a recusa do INSERT genérico protegido. O terceiro passou 355/355 SQL, mas uma negativa histórica de interface usava transfer como ação inválida; agora testa replace, mantendo o positivo de transfer. Nenhuma policy/trigger/guard foi removida para fazer o teste passar.

## Pendências para operação

| Próximo bloco | Trabalho necessário |
|---|---|
| M04 | Publicação autorizada de catálogo, formulários por ação, checklist, workflow, calendário e serviço; drafts não habilitam atendimento |
| M05 | Migration gerada, upgrade, schema/manifest/readiness e identidades restritas de aplicação/worker |
| M06 | Montar writer/resolvers e leitura semântica autorizada; unir core e evento público pelo mesmo ID/revisão |
| M08 | Qualificar identidade/contexto e obras do Novo GEO sem ampliar acesso por e-mail |
| M09/M10 | Formulários e jornada cliente/N1 usando a configuração publicada |
| M11 | Storage/scan, modelos, relógios de SLA, persistência/worker Resend, webhook e acompanhamento da entrega |
| M12 | Piloto e aceite hospedado do recorte autorizado |

**Impedimento de montagem M06:** devolutiva, retorno em aguardando cliente e resolução com mudança de status guardam o texto público no ledger semântico; o leitor vigente de `ticket_messages` não apresenta esse texto. É necessária uma projeção pública restrita. Abrir SELECT do ledger privado não é solução. A compatibilidade da transferência no histórico já foi implementada.

Admissão de planilha nesta etapa valida nome/extensão/MIME/tamanho, sem prometer análise de conteúdo, antivírus ou upload disponível. O endereço remetente, domínio verificado e chave Resend deverão ser configurados no servidor antes do ensaio real. Não houve envio real, registro no GlobalCad, alteração de Auth/grants, migration hospedada, merge ou deploy de produção nesta etapa. O pipeline do PR cria uma prévia automática de interface, que não constitui aceite hospedado do atendimento. Atendimento/gate continuam fechados.
