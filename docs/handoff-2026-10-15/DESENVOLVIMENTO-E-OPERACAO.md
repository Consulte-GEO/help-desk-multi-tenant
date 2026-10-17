# Desenvolvimento, operação e prevenção de regressões

Estas regras traduzem os contratos existentes e problemas já enfrentados pelo projeto. Não substituem os AGENTS/CLAUDE do repositório correto nem a decisão humana mais recente.

## 1. Antes de alterar

Registrar repo, branch, HEAD, arquivos modificados e estado remoto. Ler os checkpoints recentes e a composição do runtime. Consultar backlog/RF antes de inventar outro serviço. Se houver trabalho concorrente, integrar pela fonte real e não sobrescrever alterações de outro chat. Verificar se o erro é de plataforma local, configuração, capability, permissão, contrato ou implementação.

Manter mudanças pequenas. Refatoração de estilo não deve acompanhar alteração de autorização, SQL, idempotência e envio na mesma entrega sem necessidade. Não trocar framework ou reformatar todo o código para “organizar”. Melhorar legibilidade nos arquivos tocados com diff revisável.

## 2. Fronteiras e exemplos do que não fazer

| Risco | Prática correta | Atalho proibido |
| --- | --- | --- |
| Acesso entre contas/obras | Revalidar identidade, escopos, conta e todo o conjunto de recursos no servidor | Confiar em UUID/header/metadata do JWT, e-mail digitado ou filtro da UI |
| Banco privado | Papel restrito, RLS, transação e contratos de catálogo | `service_role`, postgres ou BYPASSRLS em requests; abrir a Data API/policies/grants para fazer tela passar |
| Resultado de gravação incerto | Preservar chave, corpo, versão e intenção; consultar recibo e conciliar | Gerar nova chave, repetir POST automaticamente ou dizer “falhou” sem saber |
| Resposta perdida no envio | Conciliar mesma intenção/provedor/callback | Reenviar manualmente porque não apareceu callback |
| Notas internas | Endpoint, tabela, DTO e audiência próprios | Mandar tudo ao browser e esconder com CSS; incluir notas no e-mail/export público |
| Versões e timestamps | Snapshots imutáveis, CAS, precisão necessária e relógio do servidor | Reescrever publicado, truncar microssegundos para igualar o hash ou adotar uma versão mais nova silenciosamente |
| Migração aplicada | Entrega aditiva, predecessor/hash/inventário/ACL e rollback qualificados | Editar migration histórica, executar SQL candidato direto ou reaplicar migration 19 |
| Capacidade preparada | Flag fechada até montagem, configuração e aceite | Habilitar todas as flags por existir tela/teste |
| Novo GEO | Contrato IdP/API e autoridade real qualificados | Inventar endpoint, usar SQL direto ou demo como fallback de produção |
| Engenharia | Solicitar e registrar dados aprovados pelo responsável técnico | IA definir FCK, idades, CPs, limites normativos ou aceitação de resultados |
| Arquivos | Bytes/hash/MIME/tamanho/versão verificados, scan conclusivo e escopo privado | Aprovar extensão declarada, scanner ausente, overwrite ou link público permanente |
| Produção | Ações reais autorizadas, recibos e preservação | Criar pessoas/obras/chamados fictícios para fabricar aceite; testes destrutivos na base real |
| Autenticação | Sessões de pessoas legítimas, MFA aplicável, segredos no gestor | Copiar cookies, tokens, QR, senha ou fabricar prova MFA; desligar CAPTCHA/MFA para teste |
| Build do Setup | Conferir allow-list de `cleanup-legacy.cjs` e preservar módulo novo | Rodar build desconhecido e deixar prebuild apagar implementação |
| Qualificação | Evidência da fonte exata, checks e revisão exigidos | Reduzir mínimos ou aceitar SKIP, editar logs/fingerprint ou usar aprovação de outro SHA |

## 3. Transações e integração externa

O runner usa contexto de conexão transacional e confirmação explícita de COMMIT. Um timeout pode significar rejeição antes do envio ou resultado incerto depois de uma mutação. Não tratar ambos da mesma forma. Atualização com zero linhas pode representar conflito de versão; não declarar sucesso por ausência de erro.

Para integração Help Desk–Setup–GEO, cada sistema conserva seu estado autoritativo. Uma associação requer recibo/idempotência e não deve abrir dois chamados. Uma análise HDA não escreve no GEO; uma aprovação referencia proposta/revisão exatas e não autoriza conteúdo posterior. O executor futuro deve ser determinístico, com autoridade própria e reconciliação de efeito externo. Mudança de escopo/revisão revoga o que deixou de ser válido.

Teste pelo menos, quando aplicável: concorrência e CAS; replay autorizado e divergente; ACK perdido; revogação entre leitura e gravação; expiração durante espera; troca de identidade; dados de outra conta/obra; nota interna em projeção pública; falha parcial; consumidor repetido; scanner inconclusivo; evento fora de ordem.

## 4. Migrações, versões e release

No corte pós-PR49 há 19 migrations oficiais e schema 0.25. A migration 19 muda um corpo de helper sem aumentar a versão do schema; não inferir quantidade de migrations somente pela versão 0.25. HDA possui SQL candidato separado. A instalação de HDA exige sua própria promoção/preflight, sem alterar os 19 arquivos aplicados.

Fluxo recomendado para uma mudança que realmente precise de publicação:

1. Confirmar HEAD remoto e drift de configuração/banco sem imprimir segredos.
2. Implementar e testar a mudança sobre base atual, com versão e manifesto apropriados.
3. Qualificar aplicação, PostgreSQL 17 e UI conforme escopo; conferir logs e fonte.
4. Revisar autorização e dados, com independência apropriada à mudança.
5. Preparar ordem explícita de código/schema/configuração e plano de pausa/recuperação.
6. Publicar pelo Git/CD existente, sem upload de `dist` para contornar checks.
7. Verificar deploy pronto, assets/rotas/versões/capabilities e restrições de acesso anônimo.
8. Fazer aceite real autorizado; documentar o que permaneceu fechado ou não observado.

Apenas um responsável deve promover o mesmo schema ou configuração por vez. Um rollback de aplicação não implica que apagar migrations/dados seja seguro. Para notificações, pausar rotas/grupos com nova revisão auditada preserva histórico; não desfaz mensagem já admitida.

## 5. Checklist de aceite por tipo de entrega

| Tipo | Evidência mínima |
| --- | --- |
| Formulário/cadastro | Versão publicada, campos e unidades corretos, limpeza dos campos ocultos, erro acessível, snapshot original, revisão do usuário; execução manual claramente indicada |
| Alteração de dados | Escopo revalidado, predecessor/CAS, efeitos e recibo atômicos, replay e rollback tardio |
| E-mail | Evento → fonte → intenção → tentativa → provedor → callback → caixa → portal; destinatário atual, sem PII interna/duplicação |
| Aprovação | Aprovador diferente quando exigido, MFA legítimo, versão/hash exatos, GET/HEAD sem efeito, recusa após revogação |
| Arquivo | Upload privado, hash/versão, quota e MIME reais, scan qualificado, download autorizado, retenção e limpeza demonstrados |
| SLA | Calendário/fuso/feriados, replay sem reinício, pausas e retomada, aviso sem duplicação, definição da métrica |
| Fila/relatório | Totais de conjunto autorizado, período/denominador, independência de paginação, exportação sem notas internas ou fórmulas maliciosas |
| Wiki/KB | Fonte/hash/revisor/público, conteúdo factual, links/mídias autorizados, separação interno/cliente |
| Restore | Banco+objetos+ledger/configuração/chaves recuperados sem reenvio ou efeitos duplicados; RPO/RTO medidos |

## 6. Operação que ainda precisa de dono

Definir responsáveis por triagem, filas paradas, falhas de e-mail, revogações, scanner/storage, restauração, incidentes e revisão editorial. Registrar janela de atendimento e quem assume quando o responsável não está disponível. Não inventar plantão 24x7 nem SLO comercial sem decisão.

Observabilidade útil: ID de correlação seguro, taxa de erro/latência, idade da fila, volume/retentativas, capacidade de conexões, ocupação/quota de objetos, expiração de coorte e falhas de callback. Evitar payloads privados, credenciais, corpos de formulário em logs. Um painel administrativo de alertas não é o mesmo que um serviço de operação com resposta a incidentes e escalonamento.

Retenção precisa cobrir chamados, notas, arquivos, drafts, auditoria, logs, exportações, pacotes, conteúdo editorial e prompts/saídas de IA. Datas como `retainUntil` não comprovam purge físico. Definir política com os responsáveis e implementar eliminação/retenção auditadas sem quebrar recibos. Não se estabelece neste relatório um prazo jurídico obrigatório.

## 7. Recomendações de UX e produtividade

Reusar padrões já demonstrados em help desks: filas claras, público/interno visíveis, primeira resposta distinta de solução, ajuda contextual, macros revisáveis e indicadores acionáveis. As fontes oficiais e sua aplicação estão na auditoria do ecossistema.

No produto existente, priorizar: mensagens de bloqueio que expliquem dependência, distinção de confirmação perdida, próximo passo e responsável, pendência de cliente separada de equipe, campos com exemplos/unidades, teclado/foco/contraste, estado vazio/erro real e proteção de rascunho. Reclassificação deve preservar respostas privadas; nunca despejar campos desconhecidos no descritivo público.

## 8. Atualização obrigatória de contexto após cada entrega

Atualizar backlog/status com o que foi codificado, integrado, configurado e aceito; linkar PR/SHA/evidência; anotar bloqueios e decisão substituída. Manter o histórico com rótulo de data. Documentação corrente curta reduz o risco de um próximo agente obedecer um checkpoint que já não representa a operação.
