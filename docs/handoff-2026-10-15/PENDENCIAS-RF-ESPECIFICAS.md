# Pendências específicas dos requisitos históricos

Data de corte: **15/10/2026**. Este complemento descreve os recortes que não ficam suficientemente explícitos nas **49 tarefas HD**. São **32 grupos de entrega**, identificados por **AUX-01 a AUX-32**, que detalham **48 RF com correspondência parcial**. Não são 32 tarefas automaticamente aprovadas, nem uma nova classificação de prioridade comercial.

O [MAPA-RF-BACKLOG.md](MAPA-RF-BACKLOG.md) conserva os 107 textos originais, seus estados e os vínculos com o backlog. A fonte de estado e lacuna é [RASTREABILIDADE-107-RF.csv](RASTREABILIDADE-107-RF.csv); a fonte das frentes existentes é [BACKLOG.json](BACKLOG.json). Estes recortes especificam o trabalho futuro de modo verificável, sem afirmar que toda a implementação está ausente. Antes de alterar código, reconciliar cada recorte com o SHA, os testes e a evidência atual para reutilizar o que já existe.

## Condições comuns de continuidade

- **Foco atual a confirmar:** todos os AUX derivam de requisitos históricos. A confirmação de escopo é especialmente necessária para canais novos, Android, IA geral, apontamento de tempo e processos comerciais. Registrar decisão de manter, adaptar ou adiar; não inferir aprovação de implementação a partir deste documento.
- **Adiamentos válidos:** Novo GEO/IdP/origem factual e MFA não são tarefas perdidas. Preparar contratos, critérios e implementação isolada é diferente de liberar integração ou contornar gates. Assistente cliente permanece desligado/adiado.
- **Reuso e evidência:** preservar os testes e módulos existentes; executar verificações pertinentes no SHA alterado, sem remover gates ou fabricar cobertura. PR49 já corrigiu o retorno do cliente; não reimplementar esse bug. IMP-02 usa o backend/storage publicado e requer configuração e aceite.
- **Ambientes e efeitos:** produção é o único ambiente hospedado; CI/local descartáveis são válidos. Atores, dados, envios e efeitos em produção precisam do escopo autorizado. Nenhum novo monitor recorrente de chat foi solicitado.
- **Critérios abaixo:** são propostas observáveis de aceite do recorte, não resultados já obtidos. Não prometem datas nem substituem decisões do negócio. Dependências HD indicam frentes relacionadas e pré-requisitos pertinentes, não dependência integral de toda a tarefa.
- **Dados e público:** respeitar conta/obra, revogação, notas internas, anexos privados e minimização. Click tracking compartilhado deve permanecer habilitado.

## Índice

- AUX-01 — Compartilhamento por obra, seguidores e menções (RF-PER-03, RF-PER-04, RF-CEN-12, RF-NOT-05).
- AUX-02 — Canal pré-login de assistência de acesso (RF-ACE-03).
- AUX-03 — Entradas e atalhos contextuais no Novo GEO (RF-ACE-02, RF-ACE-05, RF-CEN-09).
- AUX-04 — Diagnóstico interno e captura revisável de tela (RF-ACE-06, RF-ACE-13).
- AUX-05 — Abertura pelo Android sem perda de dados offline (RF-ACE-07).
- AUX-06 — Ficha contextual do cliente para o analista (RF-CEN-06).
- AUX-07 — Notificações no sino do GEO (RF-ACE-08, RF-NOT-05).
- AUX-08 — Busca específica no catálogo de serviços (RF-CAT-03).
- AUX-09 — Tabelas repetíveis nos formulários Help Desk (RF-FOR-03).
- AUX-10 — Reclassificação segura sem perda de respostas (RF-CAT-04).
- AUX-11 — Autosave de rascunho sem repetição de intenção (RF-FOR-06).
- AUX-12 — Vídeo curto e reprodução privada de anexos (RF-FOR-13).
- AUX-13 — Regras de espera, encerramento e reabertura (RF-CIC-04, RF-CIC-05, RF-CIC-11).
- AUX-14 — Relações entre chamados e mescla revisável (RF-CIC-09).
- AUX-15 — Subtarefas internas com responsáveis e prazo (RF-CIC-10).
- AUX-16 — Abertura em nome do cliente e canal de origem (RF-CEN-08).
- AUX-17 — Apontamento de tempo com correção auditada (RF-CEN-13).
- AUX-18 — Ações em massa com resultado por chamado (RF-CEN-14).
- AUX-19 — Gestão de incidente e avisos públicos de status (RF-BUG-05, RF-BUG-08).
- AUX-20 — Vínculo com desenvolvimento, atualização e release (RF-BUG-01, RF-BUG-03, RF-BUG-04, RF-BC-08).
- AUX-21 — Agrupar melhorias e registrar decisão institucional (RF-BUG-06).
- AUX-22 — Registrar piloto comercial de implantação (RF-PRJ-07).
- AUX-23 — Autoatendimento guiado e declaração de resolução (RF-BC-02, RF-BC-09).
- AUX-24 — Transformar resposta em rascunho editorial sanitizado (RF-BC-10).
- AUX-25 — Assistência interna de resumo, resposta e pergunta ao Dev Agent (RF-IA-03, RF-IA-04, RF-IA-05).
- AUX-26 — Classificação e similaridade de chamados avaliadas (RF-IA-02, RF-IA-08).
- AUX-27 — Assistente cliente na abertura, somente após decisão (RF-IA-07).
- AUX-28 — Governança e quotas de IA por conta e recurso (RF-IA-10).
- AUX-29 — Editor operacional de modelos de e-mail (RF-NOT-02).
- AUX-30 — Resposta por e-mail e threading autenticado (RF-NOT-04).
- AUX-31 — Canal WhatsApp oficial como extensão opcional (RF-NOT-06).
- AUX-32 — Política e evidência de consulta interna dos analistas (RF-PER-07).

## AUX-01 — Compartilhamento por obra, seguidores e menções

**RF e estado reconciliado:** RF-PER-03 — não demonstrado; RF-PER-04 — não demonstrado; RF-CEN-12 — ativo parcial; RF-NOT-05 — adiado.

**Lacuna registrada na fonte:**

- **RF-PER-03:** Definir audiência compartilhada por obra com opção explícita da conta, histórico e autorização em lista/contagem/detalhe; não ampliar tickets antigos por inferência.
- **RF-PER-04:** Implementar seguidores com cobertura de todas as obras do chamado, remoção/revogação e revalidação antes do envio. Pertencer à mesma construtora não basta.
- **RF-CEN-12:** Atribuição/transferência/motivo existem; menções internas com aviso não demonstradas. Completar nota obrigatória/roster/revogação; menção não equivale a seguidor público.
- **RF-NOT-05:** Audiências piloto publicadas; preferências individuais/sino GEO sem aceite. Definir eventos obrigatórios/opcionais e adapter quando a origem adiada estiver disponível.

**Escopo futuro concreto:** Definir audiência compartilhada opcional da obra, seguidores autorizados, menções internas e preferências de envio, sem equiparar esses quatro conceitos.

**Passos principais:**

1. Confirmar se compartilhamento/seguidores permanecem no foco atual e publicar política por conta/obra.
2. Persistir opção, vínculo, origem e revogação; não ampliar retroativamente público de tickets por inferência.
3. Validar todas as obras do chamado ao incluir colega ou gerar menção, mantendo nota interna distinta de seguidor público.
4. Integrar preferências de eventos opcionais e revalidar audiência imediatamente antes do envio.

**Dependências e adiamentos:** frentes HD-009, HD-022, HD-026, HD-004.

- Política por cliente e roster legítimo; sino GEO fica em AUX-07.
- A implementação não é autorizada apenas porque existia no RF histórico.

**Aceite observável:**

- Colega da mesma conta sem cobertura da obra não recebe acesso nem aviso.
- Remoção/revogação impede novos envios; histórico da decisão é auditável.
- Preferências não ocultam avisos obrigatórios sem regra aprovada; nota/menção interna não vaza.

## AUX-02 — Canal pré-login de assistência de acesso

**RF e estado reconciliado:** RF-ACE-03 — ativo parcial.

**Lacuna registrada na fonte:**

- **RF-ACE-03:** URL/login direto autorizados existem. Falta canal pré-login por e-mail verificado/link único restrito a assistência de acesso; posse de caixa não comprova identidade GEO.

**Escopo futuro concreto:** Confirmar e, se mantido, implementar solicitação pré-login por e-mail verificado, restrita à assistência de acesso; não confundir com redefinição de senha Auth.

**Passos principais:**

1. Aprovar categorias, limites e política contra enumeração/abuso.
2. Emitir e consumir desafio de uso único, com prazo e concorrência controlados.
3. Criar solicitação limitada com recibo, sem conceder identidade GEO ou acesso a tickets anteriores.
4. Qualificar expiração, repetição, caixa indisponível e passagem à equipe.

**Dependências e adiamentos:** frentes HD-005, HD-009, HD-049.

- Decisão de negócio/identidade e provedor de envio autorizado.
- Não altera o adiamento de SSO/MFA nem substitui HD-005.

**Aceite observável:**

- Posse do e-mail não abre outras obras ou histórico.
- Desafio vencido/consumido é recusado e repetição não duplica chamado.
- Mensagens não revelam se uma pessoa possui conta.

## AUX-03 — Entradas e atalhos contextuais no Novo GEO

**RF e estado reconciliado:** RF-ACE-02 — adiado; RF-ACE-05 — adiado; RF-CEN-09 — adiado.

**Lacuna registrada na fonte:**

- **RF-ACE-02:** Portal direto existe. Falta botão e aceite no consumidor Novo GEO com link comum, destino permitido e contexto sem credenciais; depende da origem adiada.
- **RF-ACE-05:** Falta botão por registro e contrato de referência opaca autorizada no GEO. Não inferir endpoint nem conceder acesso pelo identificador informado.
- **RF-CEN-09:** Faltam atalhos de origem permitidos e contexto autorizado por tela/tenant/obra. M08 adiada; nunca transportar tokens ou usar URL para conceder acesso.

**Escopo futuro concreto:** Implementar, quando a origem retomar, link do menu, abertura por registro e retorno à tela autorizada do GEO.

**Passos principais:**

1. Confirmar consumidores, telas e referências opacas suportadas pelo contrato real.
2. Implementar navegação por link comum, sem pop-up obrigatório e sem token na URL.
3. Validar alvo/origem/conta/obra no servidor ao resolver contexto do registro.
4. Qualificar login, retorno, deep link revogado e tentativa de trocar referência.

**Dependências e adiamentos:** frentes HD-009, HD-037, HD-049.

- Origem/API/IdP explicitamente adiados; nenhuma alteração de consumidor agora.
- Acesso e autorização do repositório Novo GEO na retomada.

**Aceite observável:**

- Menu/registro abrem destino permitido e preservam contexto autorizado.
- Identificador ou URL não concede acesso.
- Falha no registro não produz chamado com obra/autor inventados.

## AUX-04 — Diagnóstico interno e captura revisável de tela

**RF e estado reconciliado:** RF-ACE-06 — adiado; RF-ACE-13 — adiado.

**Lacuna registrada na fonte:**

- **RF-ACE-06:** Falta transporte do erro/trace GEO para seção interna sanitizada, com limites/retenção. Diagnósticos do Help Desk não comprovam captura na origem ou integração SigNoz.
- **RF-ACE-13:** Faltam captura explícita no GEO, recorte/revisão e pipeline privado. Não enviar automaticamente telas, credenciais ou dados de terceiros.

**Escopo futuro concreto:** Transportar erro/trace interno e captura explícita de tela da origem, com revisão/recorte e separação de audiência.

**Passos principais:**

1. Definir allow-list de diagnóstico, limites e retenção; não coletar payload amplo indiscriminadamente.
2. Adicionar captura sob ação do usuário e prévia para remover conteúdo privado desnecessário.
3. Enviar arquivo pelo pipeline privado e diagnóstico por DTO interno sanitizado.
4. Qualificar remoção de credenciais, acesso revogado e arquivo inseguro.

**Dependências e adiamentos:** frentes HD-017, HD-024, HD-025, HD-037.

- Consumidor Novo GEO adiado e pipeline de arquivo qualificado.
- Confirmar retenção e necessidade de cada campo de diagnóstico.

**Aceite observável:**

- Cliente revisa captura antes do envio; nenhum print automático de terceiros.
- Trace/erro interno não aparece em resposta pública/e-mail/exportação externa.
- Scanner indisponível não aprova captura para consumo.

## AUX-05 — Abertura pelo Android sem perda de dados offline

**RF e estado reconciliado:** RF-ACE-07 — adiado.

**Lacuna registrada na fonte:**

- **RF-ACE-07:** Falta contrato/integração Android para versão, pendências offline e abertura autorizada. Preservar lançamentos não sincronizados; não orientar limpeza como primeiro diagnóstico.

**Escopo futuro concreto:** Confirmar e integrar abertura pelo app com versão e quantidade de lançamentos pendentes, preservando o armazenamento offline.

**Passos principais:**

1. Obter contrato/versão do app e modelo autorizado de contexto.
2. Definir quais contagens/diagnósticos são declarados e quais a origem verifica.
3. Implementar abertura/deep link com autenticação apropriada e recibo idempotente.
4. Ensaiar offline, retorno de conexão, repetição e troca de usuário.

**Dependências e adiamentos:** frentes HD-017, HD-037, HD-049.

- Origem e consumidor Android adiados; responsável do aplicativo necessário.
- Requisito histórico não obriga mudar o app no primeiro bloco.

**Aceite observável:**

- Nenhuma limpeza de lançamentos é exigida para abrir o chamado.
- Reenvio após conexão não duplica protocolo.
- Versão/pendências não são tratadas como autorização de conta/obra.

## AUX-06 — Ficha contextual do cliente para o analista

**RF e estado reconciliado:** RF-CEN-06 — adiado.

**Lacuna registrada na fonte:**

- **RF-CEN-06:** Contexto local existe; ficha lateral completa depende das consultas GEO adiadas. Qualificar atualização/origem e cobertura por obra/material, evitando visibilidade indiscriminada da conta.

**Escopo futuro concreto:** Compor ficha lateral de contrato, obras, pessoas/grupos, histórico recente e particularidades, com fonte e atualização explícitas.

**Passos principais:**

1. Confirmar campos mínimos úteis ao atendimento e suas audiências.
2. Reutilizar contexto local e qualificar DTOs/leituras somente consulta da origem.
3. Montar projeção lateral com estado indisponível/desatualizado e limites de paginação.
4. Testar revogação, múltiplas obras e dados com nomes iguais.

**Dependências e adiamentos:** frentes HD-009, HD-023, HD-026, HD-037.

- Consultas GEO continuam adiadas; dados locais podem ser apresentados apenas com suas limitações.
- Não criar cadastro mestre paralelo do cliente.

**Aceite observável:**

- Analista não vê obras/grupos além do escopo autorizado.
- Ausência de fonte não aparece como lista vazia/uso zero comprovado.
- Tela informa origem e idade da informação.

## AUX-07 — Notificações no sino do GEO

**RF e estado reconciliado:** RF-ACE-08 — adiado; RF-NOT-05 — adiado.

**Lacuna registrada na fonte:**

- **RF-ACE-08:** Outbox/e-mail existem; sino GEO exige adapter, destinatário autorizado e deduplicação na origem, ainda adiada.
- **RF-NOT-05:** Audiências piloto publicadas; preferências individuais/sino GEO sem aceite. Definir eventos obrigatórios/opcionais e adapter quando a origem adiada estiver disponível.

**Escopo futuro concreto:** Implementar adapter de notificação interna no GEO separado do e-mail, observando preferências e deduplicação.

**Passos principais:**

1. Confirmar API/canal/eventos e identificador do destinatário na origem.
2. Definir eventos obrigatórios/opcionais com a política de AUX-01.
3. Persistir intenção/recibo e deduplicar pelo evento sem transportar segredo no link.
4. Qualificar revogação, origem indisponível, duplicatas e eventos fora de ordem.

**Dependências e adiamentos:** frentes HD-004, HD-009, HD-037.

- Origem Novo GEO adiada; não criar adapter fictício.
- Confirmar custo/limites e autorização do canal na retomada.

**Aceite observável:**

- Uma intenção não cria avisos duplicados no sino.
- Destinatário sem acesso atual não recebe novo aviso.
- E-mail entregue não é usado como prova de entrega no sino.

## AUX-08 — Busca específica no catálogo de serviços

**RF e estado reconciliado:** RF-CAT-03 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-CAT-03:** Falta busca específica no catálogo com sinônimos e universo autorizado. Busca da wiki ou de tickets não comprova busca de serviço.

**Escopo futuro concreto:** Adicionar busca por termos/sinônimos do catálogo autorizado, distinta de pesquisa de tickets e artigos.

**Passos principais:**

1. Confirmar vocabulário e campos pesquisáveis do catálogo vigente.
2. Construir índice/filtro simples sobre serviços já autorizados.
3. Integrar busca e navegação mantendo seleção/versionamento do formulário.
4. Qualificar sinônimos, sem resultado, mudança de cobertura e teclado.

**Dependências e adiamentos:** frentes HD-019, HD-023, HD-032.

- Catálogo/entitlements publicados; sem motor novo genérico como pré-requisito.

**Aceite observável:**

- Busca nunca revela serviço fora da cobertura do usuário.
- Termos frequentes encontram serviço correto sem abrir formulário obsoleto.
- Mudança de autorização remove resultados antes de abrir o pedido.

## AUX-09 — Tabelas repetíveis nos formulários Help Desk

**RF e estado reconciliado:** RF-FOR-03 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-FOR-03:** Falta tabela repetível na abertura com limites, erros por linha e confirmação. Tabelas do Setup não comprovam montagem no formulário Help Desk.

**Escopo futuro concreto:** Suportar múltiplas linhas por pedido para padrões, usuários ou usinas, com limites e revisão por item.

**Passos principais:**

1. Confirmar quais subcategorias exigem tabela e os limites por chamada.
2. Reusar motor versionado com IDs de linha e validadores de domínio.
3. Mostrar erros por célula/linha e remover campos ocultos sem perder original autorizado.
4. Qualificar inserção/remoção/reordenação, revisão e conflito de versão.

**Dependências e adiamentos:** frentes HD-011, HD-013, HD-014, HD-035.

- Modelos aprovados por domínio; não transferir automaticamente tabela do Setup como prova de montagem.

**Aceite observável:**

- Linha inválida é localizada e não aplicada silenciosamente.
- Reordenação não troca identidade de itens.
- Snapshot conserva a versão/linhas efetivamente revisadas.

## AUX-10 — Reclassificação segura sem perda de respostas

**RF e estado reconciliado:** RF-CAT-04 — preparado.

**Lacuna registrada na fonte:**

- **RF-CAT-04:** Implementar reclassificação com mapa explícito/snapshot preservado. Exibir perdas para revisão; não converter automaticamente campos privados/desconhecidos em descrição pública como propõe a redação original.

**Escopo futuro concreto:** Transferir um pedido entre formulários com mapeamento explícito, preservando o snapshot original.

**Passos principais:**

1. Definir pares de serviço permitidos e mapa dos campos compatíveis.
2. Apresentar valores que não migrarão e a audiência de cada dado.
3. Confirmar nova classificação/versão por CAS e registrar motivo/autoria.
4. Qualificar concorrência, campo desconhecido, privado e alteração de cobertura.

**Dependências e adiamentos:** frentes HD-011, HD-019.

- Decisão do operador e política de campos; redação histórica não autoriza converter tudo em descrição pública.

**Aceite observável:**

- Original permanece consultável pelo público correto.
- Campo interno não é copiado para texto público automaticamente.
- Conflito de versão não sobrescreve revisão nova.

## AUX-11 — Autosave de rascunho sem repetição de intenção

**RF e estado reconciliado:** RF-FOR-06 — ativo parcial.

**Lacuna registrada na fonte:**

- **RF-FOR-06:** Rascunho persistido e salvamento explícito existem. Autosave durante digitação não foi demonstrado; definir frequência/conflitos/descarte sem repetir mutações ou perder intenção incerta.

**Escopo futuro concreto:** Adicionar salvamento automático ao draft existente com estado visível, conflitos e cancelamento seguro.

**Passos principais:**

1. Definir frequência/debounce e quais alterações disparam persistência.
2. Reusar versão/recibo e serializar salvamentos em andamento.
3. Apresentar salvo/pendente/erro/conflito sem criar novo comando após resposta incerta.
4. Ensaiar navegação, logout, troca de conta e recuperação após falha.

**Dependências e adiamentos:** frentes HD-011, HD-019.

- Contrato de draft existente; não usar localStorage como fallback operacional.
- Confirmar UX e política de descarte.

**Aceite observável:**

- Nenhuma edição antiga sobrescreve nova revisão.
- Resposta perdida recupera recibo original e não duplica mutação.
- Troca de identidade não reinstala rascunho privado anterior.

## AUX-12 — Vídeo curto e reprodução privada de anexos

**RF e estado reconciliado:** RF-FOR-13 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-FOR-13:** Falta upload/reprodução privada de vídeo no chamado com limites/MIME/scan/retenção/recorte. Contratos de anexos e mídia da wiki não comprovam esta jornada.

**Escopo futuro concreto:** Completar upload e reprodução de gravação curta com limites de conteúdo, tamanho, duração e retenção.

**Passos principais:**

1. Confirmar formatos/tamanhos/duração úteis e política de recorte.
2. Integrar upload imutável e inspeção real dos bytes no pipeline existente.
3. Montar preview/reprodução autorizada e estados pending/rejected.
4. Qualificar URL expirada, revogação, arquivo malformado e quota.

**Dependências e adiamentos:** frentes HD-017, HD-024, HD-025.

- Scanner/storage e política aprovados; mídia da Wiki não comprova anexo de atendimento.

**Aceite observável:**

- Vídeo não é reproduzido antes de inspeção conclusiva.
- Link privado não concede acesso depois da revogação.
- Falha/expiração tem mensagem clara sem liberar objeto público.

## AUX-13 — Regras de espera, encerramento e reabertura

**RF e estado reconciliado:** RF-CIC-04 — preparado; RF-CIC-05 — ativo parcial; RF-CIC-11 — preparado.

**Lacuna registrada na fonte:**

- **RF-CIC-04:** Há base de workflow/SLA/templates; faltam política de lembrete/encerramento, scheduler idempotente e aceite. Ausência de entrega ou falha de integração não deve fechar chamado.
- **RF-CIC-05:** Workflow prevê sete dias e motivo. Reabertura/fechamento aguardam aceite da onda2; comprovar novo chamado vinculado após a janela, sem reabrir por GET.
- **RF-CIC-11:** Resolução existe; falta taxonomia publicada de motivos e relatórios. Encaminhamento deve conservar dono/acompanhamento, sem fingir resolução técnica.

**Escopo futuro concreto:** Detalhar lembretes por falta de resposta, eventual encerramento com aviso, motivo padronizado e novo chamado vinculado após a janela de reabertura.

**Passos principais:**

1. Aprovar prazos/motivos/pausas e separar ausência do cliente de falha de entrega.
2. Reusar relógios/eventos para intents de aviso e fechamento elegíveis.
3. Implementar vínculo ao chamado anterior após a janela sem reabrir via GET.
4. Qualificar retorno simultâneo, lembrete duplicado, aviso não entregue e mudança de política.

**Dependências e adiamentos:** frentes HD-003, HD-010, HD-019, HD-020, HD-021, HD-028.

- Política publicada e aceite da onda2; sete dias/exemplos históricos não substituem vigência instalada.

**Aceite observável:**

- Resposta recebida a tempo impede encerramento obsoleto.
- Falha do provedor ou integração não é interpretada como silêncio do cliente.
- Motivo/vínculo e política ficam auditáveis sem reiniciar prazo por replay.

## AUX-14 — Relações entre chamados e mescla revisável

**RF e estado reconciliado:** RF-CIC-09 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-CIC-09:** Falta relação tipada/mescla com autoria e duas conversas preservadas. Clientes distintos podem compartilhar causa, nunca conversa/anexo automaticamente.

**Escopo futuro concreto:** Adicionar relações tipadas e procedimento de mescla que preserve protocolos, autores, conversas e audiências.

**Passos principais:**

1. Definir duplicado/relacionado/pai-filho e operações permitidas.
2. Registrar vínculo sem copiar conteúdo entre contas.
3. Apresentar plano de mescla e revisar diferenças de participantes/anexos.
4. Executar por intenção/recibo e qualificar conflito e rollback limitado.

**Dependências e adiamentos:** frentes HD-017, HD-019.

- Política de suporte e autorização em cada ticket; relação de causa não compartilha conversa.

**Aceite observável:**

- Dois protocolos e autorias permanecem rastreáveis.
- Cliente não ganha conversa/anexo do outro chamado.
- Mescla repetida não perde mensagens nem duplica notificação.

## AUX-15 — Subtarefas internas com responsáveis e prazo

**RF e estado reconciliado:** RF-CIC-10 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-CIC-10:** Faltam subtarefas internas com dono/prazo/dependência/histórico. Checklist não é subtarefa; nenhuma subatividade deve ampliar a audiência do ticket.

**Escopo futuro concreto:** Criar subatividades internas distintas de checklist, com dono, prazo, dependência e histórico.

**Passos principais:**

1. Definir estados/escopo e relação com a conclusão do ticket.
2. Persistir atribuição/prazo e transições com autorização interna.
3. Exibir pendências sem ampliar a projeção pública.
4. Qualificar reatribuição, revogação, concorrência e fechamento do pai.

**Dependências e adiamentos:** frentes HD-019, HD-035.

- Decisão de processo; reaproveitar workflow sem transformar cada item de checklist em tarefa automática.

**Aceite observável:**

- Subtarefa tem dono e prazo consultáveis pela equipe autorizada.
- Cliente não recebe nota/estado interno por herança.
- Regra de fechar ticket com subtarefa aberta é explícita e testada.

## AUX-16 — Abertura em nome do cliente e canal de origem

**RF e estado reconciliado:** RF-CEN-08 — preparado.

**Lacuna registrada na fonte:**

- **RF-CEN-08:** Há contratos de intake/beneficiário; on-behalf/canal completo não demonstrado. Verificar solicitante, separar executor/motivo/proveniência; isso não integra WhatsApp.

**Escopo futuro concreto:** Completar intake on-behalf com solicitante/beneficiário/executor separados e canal declarado auditável.

**Passos principais:**

1. Confirmar alçada para abrir em nome de outra pessoa.
2. Reusar intake com verificação viva de pessoa/conta/obra.
3. Registrar canal, motivo e autoria sem simular sessão do cliente.
4. Qualificar pessoa sem vínculo, troca de contexto, repetição e devolutiva.

**Dependências e adiamentos:** frentes HD-009, HD-012, HD-017.

- Identidades e autorização legítimas; telefone/WhatsApp/reunião são canais declarados, não integrações de envio.

**Aceite observável:**

- Analista não pode escolher beneficiário fora da cobertura.
- Evento conserva quem abriu e em nome de quem.
- Destinatário recebe informação mínima correta sem autoria falsificada.

## AUX-17 — Apontamento de tempo com correção auditada

**RF e estado reconciliado:** RF-CEN-13 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-CEN-13:** Falta apontamento explícito, correção auditada e relatório. Separar esforço, duração total e SLA; não inferir produtividade por cliques ou sessão aberta.

**Escopo futuro concreto:** Registrar esforço informado por pessoa/atividade, distinto da duração do ticket e do SLA.

**Passos principais:**

1. Confirmar necessidade atual, categorias e privacidade do apontamento.
2. Persistir início/fim ou duração declarada conforme política, com validação.
3. Permitir correção por evento com motivo, sem apagar histórico.
4. Construir relatório de esforço separado dos clocks.

**Dependências e adiamentos:** frentes HD-028.

- Requisito histórico a confirmar com operação; não inferir produtividade por clique ou aba aberta.

**Aceite observável:**

- Total reconcilia registros e correções.
- Tempo de espera não vira esforço automático.
- Relatório informa unidade/período e acesso autorizado.

## AUX-18 — Ações em massa com resultado por chamado

**RF e estado reconciliado:** RF-CEN-14 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-CEN-14:** Faltam ações em massa com autorização por ticket, resumo e resultado por item. Preservar chaves/recibos; não repetir lote todo após falha parcial.

**Escopo futuro concreto:** Responder, atribuir, vincular e encerrar conjuntos revisados com autorização e resultado individual.

**Passos principais:**

1. Confirmar ações elegíveis e limite de lote.
2. Apresentar prévia com público, destinatário e versão de cada item.
3. Persistir intenção por ticket e executar revalidando escopo/versão.
4. Mostrar sucesso/falha/incerto por item e reconciliar apenas os pendentes.

**Dependências e adiamentos:** frentes HD-017, HD-019, HD-004.

- Autoridade em cada chamado e política de comunicação; não repetir lote inteiro após falha parcial.

**Aceite observável:**

- Item revogado/conflitante não é processado por ter entrado na lista.
- Retry não duplica mensagem/encerramento confirmado.
- Erro parcial não apaga os recibos dos itens concluídos.

## AUX-19 — Gestão de incidente e avisos públicos de status

**RF e estado reconciliado:** RF-BUG-05 — não demonstrado; RF-BUG-08 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-BUG-05:** Falta processo de incidente com autoridade, audiência, encerramento e ação em massa por intenção autorizada. Templates não comprovam gestão de incidente.
- **RF-BUG-08:** Falta página pré-login de status global aprovado e processo de publicação/retirada. Não expor obra/cliente ou inferir incidente global de falha isolada.

**Escopo futuro concreto:** Definir declaração/encerramento de incidente, relações privadas e publicação pré-login de aviso global sanitizado.

**Passos principais:**

1. Aprovar autoridade, severidade, audiência e responsável por atualização.
2. Vincular tickets sem unir suas conversas e controlar ações em massa por AUX-18.
3. Publicar aviso global revisado com vigência/retirada, sem dados de cliente.
4. Encerrar com evidência e qualificar visibilidade/expiração/cache.

**Dependências e adiamentos:** frentes HD-017, HD-019, HD-004, HD-046.

- Confirmar página pré-login no foco atual; não criar novo monitor recorrente por inferência.
- Incidente global exige decisão, não nasce de qualquer erro individual.

**Aceite observável:**

- Visitante pré-login não vê cliente/obra/trace privado.
- Aviso retirado deixa de aparecer segundo a política de cache.
- Resposta em massa mantém autorização/recibo por ticket.

## AUX-20 — Vínculo com desenvolvimento, atualização e release

**RF e estado reconciliado:** RF-BUG-01 — preparado; RF-BUG-03 — preparado; RF-BUG-04 — preparado; RF-BC-08 — preparado.

**Lacuna registrada na fonte:**

- **RF-BUG-01:** External-work/escalonamento preparados. Falta montar link manual autorizado/status/resumo e retorno; não criar item remoto nem expor trace público automaticamente.
- **RF-BUG-03:** Templates/macros/workflow fornecem base. Falta cadência aprovada/scheduler separado do SLA; cinco dias são exemplo, e correção precisa de release real.
- **RF-BUG-04:** External-work é base candidata. Falta N tickets→item, prova de release, aviso individual com ACL/revogação e revisão editorial; não juntar conversas entre clientes.
- **RF-BC-08:** Wiki contém mudanças e fluxo editorial; falta cadeia release GEO→artigos afetados→revisão/publicação. Backlog ou merge não equivalem a funcionalidade implantada.

**Escopo futuro concreto:** Conectar tickets a item externo/manual, cadência aprovada e release comprovado, acionando revisão dos artigos relacionados.

**Passos principais:**

1. Definir referência externa e resumo técnico sanitizado; manter link manual quando suficiente.
2. Registrar múltiplos tickets e dono do atendimento, sem publicação remota automática.
3. Separar prazo de atualização do SLA e implementar lembrete aprovado.
4. Confirmar release implantado antes da devolutiva individual e abrir revisão editorial por artigo.

**Dependências e adiamentos:** frentes HD-017, HD-019, HD-004, HD-021, HD-030, HD-031, HD-032.

- Integração externa somente se autorizada; cinco dias é exemplo histórico.
- Origem Novo GEO/revisão factual permanecem adiadas quando necessárias à comprovação.

**Aceite observável:**

- Encaminhar não marca solução técnica nem elimina responsável.
- Notificação por release respeita acesso atual de cada ticket.
- Artigo afetado entra em revisão; merge/backlog não é declarado funcionalidade publicada.

## AUX-21 — Agrupar melhorias e registrar decisão institucional

**RF e estado reconciliado:** RF-BUG-06 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-BUG-06:** Falta agrupamento/contagem privada por construtora e decisão institucional versionada. Não expor clientes nem transformar demanda em promessa de entrega.

**Escopo futuro concreto:** Manter temas de melhoria, demandas por cliente e decisões versionadas sem promessa automática.

**Passos principais:**

1. Confirmar processo de produto e quem decide.
2. Criar vínculo privado ticket→tema com contagem de clientes distintos.
3. Registrar avaliação/não planejado/entregue com motivo e fonte.
4. Expor somente projeção permitida e reconciliar contagem após remoção/duplicata.

**Dependências e adiamentos:** frentes HD-017, HD-028.

- Requisito histórico a confirmar com produto; não atribuir prioridade comercial neste complemento.

**Aceite observável:**

- Dois pedidos do mesmo cliente não viram duas construtoras.
- Lista de clientes permanece privada.
- Entregue requer evidência e não prazo inferido da demanda.

## AUX-22 — Registrar piloto comercial de implantação

**RF e estado reconciliado:** RF-PRJ-07 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-PRJ-07:** Falta registro de piloto comercial com escopo/duração/áreas/critérios/decisão. Piloto técnico de e-mails não atende este RF; condições comerciais exigem responsável.

**Escopo futuro concreto:** Representar piloto comercial com obras, período, envolvidos, critérios, checkpoints e decisão final.

**Passos principais:**

1. Confirmar responsável comercial, escopo e condições específicas.
2. Versionar critérios/obras/início/duração sem herdar prazo do piloto de e-mail.
3. Registrar checkpoints/decisões e separar acesso técnico de aceite comercial.
4. Qualificar encerramento/extensão explícitos e projeção para cliente.

**Dependências e adiamentos:** frentes HD-023, HD-035.

- Decisão comercial legítima; não impor um novo piloto nem prometer duração.

**Aceite observável:**

- Piloto técnico de e-mail/HDA não encerra este RF.
- Extensão não altera contrato/acesso silenciosamente.
- Critérios e decisão final têm autor, data e evidência.

## AUX-23 — Autoatendimento guiado e declaração de resolução

**RF e estado reconciliado:** RF-BC-02 — preparado; RF-BC-09 — preparado.

**Lacuna registrada na fonte:**

- **RF-BC-02:** Knowledge/feedback têm base candidata; falta artigo/isso resolveu na abertura. Curar artigos e registrar autodeclaração, sem chamar o evento prova causal de ticket evitado.
- **RF-BC-09:** Runbooks/FAQs internos existem. Falta roteiro interativo com saída humana e contexto/classificação preservados; nenhum script de manutenção deve ser oferecido como simples diagnóstico.

**Escopo futuro concreto:** Adicionar roteiro interativo aprovado e resposta 'isso resolveu', preservando saída para atendimento humano.

**Passos principais:**

1. Selecionar casos frequentes e artigos públicos aprovados.
2. Modelar perguntas/saídas sem scripts destrutivos nem conclusão inventada.
3. Registrar resposta do usuário e, se abrir ticket, conservar classificação/contexto autorizado.
4. Medir uso e autodeclaração separadamente de causalidade de ticket evitado.

**Dependências e adiamentos:** frentes HD-017, HD-031, HD-032, HD-028.

- Conteúdo apto por audiência; revisão factual adiada limita os roteiros disponíveis.

**Aceite observável:**

- Usuário consegue abrir chamado sem concluir o roteiro.
- Resposta sim não encerra ticket já existente sem comando próprio.
- Métrica informa autodeclaração e não prova automática de resolução técnica.

## AUX-24 — Transformar resposta em rascunho editorial sanitizado

**RF e estado reconciliado:** RF-BC-10 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-BC-10:** Falta transformar resposta em rascunho sanitizado com fonte e revisão humana. Não copiar conversa/anexo/PII ou detalhes do cliente para artigo.

**Escopo futuro concreto:** Gerar rascunho revisável a partir de resposta selecionada, sem publicar conversa privada.

**Passos principais:**

1. Definir quem pode iniciar e quais campos podem ser propostos.
2. Remover nomes, conta/obra, anexos privados e segredos antes do rascunho.
3. Manter referência privada mínima à origem e submeter ao editor por hash/audiência.
4. Qualificar revisão, descarte e publicação somente após aprovação.

**Dependências e adiamentos:** frentes HD-030, HD-031, HD-032.

- Permissão editorial e revisão humana; nenhum clique publica diretamente.

**Aceite observável:**

- Rascunho não copia conversa inteira ou dados pessoais.
- Autor/revisor e fonte ficam rastreáveis no público correto.
- Material sem aprovação não aparece na central cliente.

## AUX-25 — Assistência interna de resumo, resposta e pergunta ao Dev Agent

**RF e estado reconciliado:** RF-IA-03 — não demonstrado; RF-IA-04 — preparado; RF-IA-05 — preparado.

**Lacuna registrada na fonte:**

- **RF-IA-03:** Falta resumo da conversa/técnico com escopo autorizado, fontes e revisão. Não expor notas internas ao cliente ou tratar conjectura como fato.
- **RF-IA-04:** Há contratos de assistência; falta sugestão operacional com fontes aptas, edição, confirmação e logs minimizados. Provedor ativo de resposta geral não demonstrado.
- **RF-IA-05:** Bridge/supervisor/contratos Dev Agent candidatos existem. Faltam host/CLI/identidade/modelo/custos reais, isolamento, montagem e retorno auditado em nota; HDA não está liberado.

**Escopo futuro concreto:** Qualificar funções de assistência geral ao ticket, distintas da análise cadastral HDA, com fontes e decisão humana.

**Passos principais:**

1. Confirmar quais funções permanecem no foco e desenhar DTOs de público interno.
2. Montar provedor/worker autorizado com fontes permitidas, orçamento e retorno como rascunho/nota.
3. Exibir citações, incerteza e prévia editável, separando fato de conjectura.
4. Avaliar vazamento, prompt injection, erro factual, timeout e passagem ao analista.

**Dependências e adiamentos:** frentes HD-017, HD-019, HD-031, HD-032, HD-038, HD-039, HD-040, HD-041, HD-044.

- Host/CLI/modelo/custos/isolamento qualificados; nenhuma ativação automática pelo bridge existente.
- Corpus apto e origem apenas quando disponível.

**Aceite observável:**

- Resumo interno nunca é enviado ao cliente por padrão.
- Sugestão não muda prioridade nem envia resposta sozinha.
- Pergunta geral ao Dev Agent não recebe credenciais ou poderes do desenvolvedor.

## AUX-26 — Classificação e similaridade de chamados avaliadas

**RF e estado reconciliado:** RF-IA-02 — não demonstrado; RF-IA-08 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-IA-02:** Falta classificador avaliado com limiar/calibração e decisão humana. Sugestão não altera prioridade/SLA; análise HDA de cadastro não comprova classificação geral.
- **RF-IA-08:** Falta similaridade de tickets avaliada por escopo/tempo. Similaridade de planilhas Setup não comprova incidentes; não agregar conteúdo de clientes distintos.

**Escopo futuro concreto:** Oferecer classificação/similaridade por contexto e tempo com limiar validado, sem execução automática.

**Passos principais:**

1. Confirmar necessidade e obter corpus sanitizado e autorizado de avaliação.
2. Definir classes, sinônimos, janelas e métricas de erro por domínio.
3. Calibrar confiança e apresentar evidências ao analista.
4. Qualificar separação entre clientes, falso positivo, fonte insuficiente e mudança de modelo.

**Dependências e adiamentos:** frentes HD-010, HD-017, HD-041.

- Requisito histórico a confirmar; similaridade do Setup não atende tickets.
- Sem corpus/modelo qualificados, manter triagem humana.

**Aceite observável:**

- Sugestão não altera SLA/prioridade sem decisão registrada.
- Baixa confiança pede análise humana.
- Causa comum não expõe textos/anexos de outros clientes.

## AUX-27 — Assistente cliente na abertura, somente após decisão

**RF e estado reconciliado:** RF-IA-07 — adiado.

**Lacuna registrada na fonte:**

- **RF-IA-07:** Assistente segue desligado e corpus público não aprovado. Aguardar conteúdo apto, provedor/quotas e ativação deliberada; exigir consentimento para anexar conversa e saída humana.

**Escopo futuro concreto:** Se retomado, oferecer assistente baseado exclusivamente em conteúdo público aprovado com saída humana e consentimento para anexar conversa.

**Passos principais:**

1. Confirmar decisão de ativação, públicos e casos permitidos.
2. Qualificar corpus, provedor, limites de custo e critérios de recusa.
3. Integrar abertura de chamado preservando contexto e consentimento explícito.
4. Avaliar respostas sobre limites, vazamento, indisponibilidade e transferência.

**Dependências e adiamentos:** frentes HD-030, HD-031, HD-032, HD-041.

- Assistente atualmente adiado/desligado; não ativar neste complemento.
- Depende de conteúdo aprovado e infraestrutura, não apenas de botão.

**Aceite observável:**

- Artigo interno nunca é fonte de resposta externa.
- Usuário abre chamado diretamente e decide se compartilha a conversa.
- Falha/limite de IA não bloqueia suporte humano.

## AUX-28 — Governança e quotas de IA por conta e recurso

**RF e estado reconciliado:** RF-IA-10 — preparado.

**Lacuna registrada na fonte:**

- **RF-IA-10:** Flags/capabilities/limites candidatos existem. Faltam quotas/custo distribuídos, painel e kill switch efetivo por conta/recurso; desligar IA não bloqueia suporte humano.

**Escopo futuro concreto:** Implementar configuração desligável, consumo/custo observável e limite distribuído para cada recurso efetivamente ativado.

**Passos principais:**

1. Confirmar unidade de custo, limites e quem pode alterar a configuração.
2. Reservar consumo de forma concorrente antes do despacho e reconciliar resultado.
3. Montar painel autorizado e mecanismo de interrupção que impeça novos despachos.
4. Ensaiar paralelismo, timeout do provedor, erro de contagem e desligamento em andamento.

**Dependências e adiamentos:** frentes HD-002, HD-041, HD-044, HD-046.

- Orçamento/aprovação por recurso; não criar monitor de chat nem ativar recurso ao instalar o painel.

**Aceite observável:**

- Duas instâncias não ultrapassam limite por corrida de contagem.
- Desligamento impede novo despacho sem prometer desfazer efeito iniciado.
- Suporte humano funciona com IA desligada ou quota esgotada.

## AUX-29 — Editor operacional de modelos de e-mail

**RF e estado reconciliado:** RF-NOT-02 — ativo parcial.

**Lacuna registrada na fonte:**

- **RF-NOT-02:** Templates/variáveis restritas e publicação privada existem. Falta edição administrativa operacional segura e aceite por evento; preservar payload histórico, sem HTML arbitrário.

**Escopo futuro concreto:** Completar edição administrativa versionada de templates por evento com variáveis limitadas e prévia.

**Passos principais:**

1. Definir alçada e quais partes podem ser editadas sem HTML arbitrário.
2. Reusar catálogo/variáveis, sanitização, versões e publicação por revisão.
3. Apresentar prévia desktop/mobile e validar links/audiência antes de publicar.
4. Qualificar rollback de template e preservação do payload já selado.

**Dependências e adiamentos:** frentes HD-004, HD-023, HD-032.

- Administração/MFA quando aplicável e política de publicação.
- Click tracking compartilhado permanece habilitado.

**Aceite observável:**

- Modelo novo não reescreve mensagem histórica/intent selada.
- Variável interna não aparece em template cliente.
- Publicação exige versão compatível e links seguros.

## AUX-30 — Resposta por e-mail e threading autenticado

**RF e estado reconciliado:** RF-NOT-04 — preparado.

**Lacuna registrada na fonte:**

- **RF-NOT-04:** Resposta por e-mail não está ativa. Implementar inbound/threading, identidade/autorização, dedup, scan e remoção do histórico; From/token de endereço não concede acesso.

**Escopo futuro concreto:** Implementar inbound como capacidade separada da notificação outbound, mantendo identidade, audiência e deduplicação.

**Passos principais:**

1. Confirmar provedor inbound, domínios, threading e política de participantes.
2. Validar origem/assinatura, destinatário/contexto e identidade atual sem confiar apenas em From.
3. Persistir mensagem/recibo, remover histórico citado e inspecionar anexos antes do consumo.
4. Qualificar duplicata, encaminhamento, reply de pessoa revogada e resposta fora de ordem.

**Dependências e adiamentos:** frentes HD-002, HD-004, HD-024, HD-025.

- Canal novo a confirmar no foco atual; conta/provedor e efeitos autorizados separadamente.
- Contratos outbound não provam inbound ativo.

**Aceite observável:**

- Mensagem repetida não gera duas respostas/tickets.
- From/endereço tokenizado sozinho não concede acesso.
- Conteúdo interno citado não vaza para público e arquivo inseguro fica isolado.

## AUX-31 — Canal WhatsApp oficial como extensão opcional

**RF e estado reconciliado:** RF-NOT-06 — não demonstrado.

**Lacuna registrada na fonte:**

- **RF-NOT-06:** Faltam API oficial, consentimentos, templates/provedor/custos e conciliação. Canal de origem ou botão que abre WhatsApp não equivale a integração de envio.

**Escopo futuro concreto:** Confirmar demanda e, somente depois, definir integração oficial por cliente com consentimento, templates e recibos.

**Passos principais:**

1. Registrar decisão de produto e clientes elegíveis; canal permanece não ativo até lá.
2. Qualificar API oficial/provedor, custos, consentimento e opt-out.
3. Modelar intenções/estado de entrega e minimizar conteúdo/link autorizado.
4. Ensaiar duplicatas, número trocado, revogação e indisponibilidade sem fallback não aprovado.

**Dependências e adiamentos:** frentes HD-004, HD-009.

- Requisito histórico sem confirmação de prioridade atual; não contratar serviço ou enviar mensagem por inferência.
- Canal declarado na abertura não equivale a integração WhatsApp.

**Aceite observável:**

- Nenhum envio ocorre sem opt-in/política e destinatário atuais.
- Callback/recibo distinguem aceito, entregue e falha.
- Opt-out ou revogação impede novo envio.

## AUX-32 — Política e evidência de consulta interna dos analistas

**RF e estado reconciliado:** RF-PER-07 — ativo parcial.

**Lacuna registrada na fonte:**

- **RF-PER-07:** MFA/guardas sensíveis existem; titular adiou MFA do aprovador sem remover proteção. Completar política de leitura registrada dos analistas, roster/capacidades e aceite legítimo.

**Escopo futuro concreto:** Explicitar registro de acesso interno necessário ao atendimento e sua minimização, separado do log de mutações.

**Passos principais:**

1. Confirmar eventos de leitura relevantes, finalidade, retenção e público da auditoria.
2. Reusar identidade/escopo e registrar quem consultou qual recurso sem duplicar conteúdo sensível.
3. Oferecer busca restrita por pessoa/recurso/período.
4. Qualificar consulta negada, MFA aplicável, revogação e carga do registro.

**Dependências e adiamentos:** frentes HD-007, HD-009, HD-022, HD-026.

- Política de acesso e retenção aprovadas; MFA do titular continua adiado para ações dependentes.
- Não coletar cliques indiscriminadamente para medir produtividade.

**Aceite observável:**

- Equipe de auditoria autorizada identifica consultas relevantes por fonte/data.
- Registro não abre acesso ao conteúdo do ticket nem contém bearer.
- Falha do log segue política explícita, sem bypass silencioso de autorização.

## Regra de atualização

Quando um recorte for aceito no foco atual, vinculá-lo à tarefa executiva apropriada e registrar decisão, responsável e evidência. Se uma implementação existente já o atender, atualizar o estado somente após verificar o comportamento pertinente. Se for substituído ou permanecer adiado, conservar o histórico e o motivo; não transformar silêncio, um arquivo ou uma sugestão em aceite.

