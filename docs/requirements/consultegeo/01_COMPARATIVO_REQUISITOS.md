# Comparativo — levantamento do Claude × planejamento existente × implementação

**Data:** 12/10/2026. **Documento recebido:** `Requisitos Help Desk.md`, de 12/10/2026. **Base remota final consultada:** `6f7bc832d504ec1285d6125b68ab83be70c1f57f` na branch `codex/m1-reproducibilidade`.

## 1. Conclusão executiva

O documento contribui de forma relevante e corrige a ordem de prioridade do plano anterior. Seu ponto central não é um help desk de perguntas frequentes: é a porta de entrada dos cadastros e ajustes que a Consulte executa para o cliente. Os fluxos de Dúvidas/Relatar problemas continuam úteis, mas não devem ser o único objetivo do primeiro produto.

O plano anterior, `02_PLANO_DE_DESENVOLVIMENTO.md` do pacote WikiV3 de 11/10, propunha começar por Dúvidas/Relatar problemas, depois diagnósticos e cadastros sensíveis. A nova proposta coloca Cadastro e a central de execução no núcleo do MVP. Esta revisão adota essa direção como hipótese de produto fornecida pelo levantamento, sem afirmar que medimos o volume real de chamados. “Maior volume” e 1.100 obras/37 construtoras ainda precisam de medição/atualização.

Não é necessário recomeçar os 18 ciclos ou criar um motor paralelo. Identidade, autorização por recurso, formulários, workflow/SLA, rascunhos, revisão, anexos, outbox, portal e piloto já têm componentes consolidados. O esforço principal é completar persistência e integrações, compor as jornadas e tornar as ações do analista seguras e verificáveis.

## 2. Fontes, força da evidência e limites

| Fonte | Uso nesta revisão | O que não prova |
|---|---|---|
| `Requisitos Help Desk.md`, linhas 1–310 | Requisitos propostos, códigos, prioridades, perfis, campos e rationale | Não é contrato assinado de SLA, introspecção da API, inventário atual de usuários ou autorização de produção |
| Plano WikiV3 de 11/10 e seu diagnóstico | Comparação da ordem das etapas HDW e achados da wiki | Não transforma exemplos/treinamento em capacidades verificadas do GEO |
| Plano de implantação original, arquitetura e global constraints | Preservação de segregação, autorização, precisão temporal, outbox, evidências e gates | Não encerra módulos só pela existência de código |
| HEAD remoto 6f7bc83 e fontes de workflow lidas por conector | Interface efetiva a estender; base exata de integração | Não é execução desta alteração no runtime ou no PostgreSQL |
| HDW-00/00b integrada no PR27 | Curadoria e análise privada de fontes já produzidas | Ainda não é conteúdo público aprovado ou integrado automaticamente |

O levantamento alega origem no POP-01, wiki e treinamentos. A matriz conserva essa atribuição como afirmação do levantamento. Não foi recebida uma cópia nova do POP-01 que permita resolver todos os conflitos por primazia documental. Nomes de endpoints e papéis não foram preenchidos com conhecimento genérico. Não houve consulta aos dados de negócio do GEO.

## 3. Inventário completo do levantamento

Foram encontrados **107 requisitos RF distintos**: 52 MVP, 43 Fase 2 e 12 Fase 3. O documento define a sigla RNF na introdução, mas não apresenta requisitos RNF codificados. A matriz acompanha os 107 códigos originais e não cria a aparência de RNFs vindos da fonte.

| Família de código | Quantidade |
|---|---:|
| PER — perfis | 8 |
| ACE — acesso/integração | 13 |
| CAT — catálogo | 5 |
| FOR — formulários | 13 |
| CIC — ciclo de vida | 11 |
| CEN — central | 15 |
| BC — conhecimento | 10 |
| IA | 10 |
| NOT — notificações | 6 |
| BUG — problemas/incidentes | 8 |
| PRJ — implantação/backup | 8 |

Na avaliação: **32 acrescentar/antecipar; 49 reaproveitar e integrar; 26 ajustar explicitamente**. Isso é classificação de análise, não contagem de funcionalidades novas prontas. Perfis, nove categorias, tabelas de campos e dez etapas de implantação também foram considerados, embora não tenham RF próprio em todas as linhas.

## 4. Contribuições que mudam o produto

### 4.1 Cadastro como primeira jornada, não só formulário

Os formulários de usuário, traço, usina, laboratório, projetista e materiais especificam o que a equipe precisa conferir. O resultado desejado não é “ticket criado”, e sim pedido entendido, executado por pessoa autorizada, conferido e devolvido ao cliente sem retrabalho. Cadastro de usuários precisa diferenciar incluir/alterar/desativar/reenviar acesso e separar solicitante, beneficiário e executor.

**Mudança no plano:** o primeiro piloto técnico reúne Cadastro de usuário + Dúvida/Relatar problema básicos, com uma central N1 utilizável. Isso é um recorte explícito para provar integração; não significa cumprir os 52 requisitos MVP nem substituir todo o legado. Os demais cadastros e as jornadas obrigatórias entram na sequência antes da aceitação do MVP completo.

### 4.2 Checklist de execução e cuidado com ação sensível

RF-CEN-07, RF-CEN-11 e RF-PRJ-03 acrescentam uma obrigação operacional que não estava ligada à resolução no workflow existente: conferir as etapas da execução e registrar evidência antes de finalizar. Para traços, padrão/idades/quantidades precisam ser conferidos com a qualidade; para usuário, grupo/obras/materiais/e-mails precisam corresponder à solicitação. Não basta a aplicação aceitar um texto de resolução.

**Desenvolvimento desta rodada:** referência de checklist fixada no perfil, snapshot privado, guarda na operação `resolve` existente e resumo na auditoria. Faltam marcação, interface e persistência durável para uso real. Ações sensíveis exigem reconhecimento e evidência no modelo, mas isso não é autorização de origem nem validação técnica de engenharia.

### 4.3 Origem humana do pedido e central do analista

RF-CEN-08 antecipa registrar o que chegou por WhatsApp, telefone, e-mail ou reunião. O canal de origem é metadado; não autoriza leitura de inbox ou integração automática do WhatsApp. O executor autenticado e o beneficiário qualificado ficam distintos e o cliente vê apenas a audiência permitida do chamado.

Filas por equipe, checklist, painel de contexto e link manual para desenvolvimento melhoram o dia a dia sem depender da escrita via API GEO da Fase 3. O plano passa a exigir a central junto com a primeira jornada, em vez de deixar uma tela de abertura sem operação completa do outro lado.

### 4.4 Implantação como etapas

RF-PRJ-01 e as dez etapas do documento distinguem conferência de arquivos, configuração, fornecedores, estrutura, traços, pessoas, histórico, liberação, treinamento e checkpoints. A lista é um ponto de partida para template versionado, não dez gravações automáticas no GEO. Nova obra ainda não possui ID da origem; deve existir uma intenção de implantação vinculada à conta autorizada, nunca um wildcard ou UUID fictício.

### 4.5 Contexto diagnóstico e perfis específicos

RF-ACE-04/06 e os oito perfis dão mais nitidez a tela/material/versão/erro/trace e ao que usuário externo, N1, N2 e N3 podem fazer. Esses dados ajudam diagnóstico, mas identidade e permissões continuam nas fontes confiáveis. O grupo do GEO precisa ser mapeado para capacidade explícita; N3 não recebe resposta pública somente porque é interno.

### 4.6 Catálogo agora tem uma proposta de nove famílias

O plano anterior preservava as cinco famílias efetivamente encontradas na wiki. O novo documento oferece uma proposta adicional explícita: Cadastro, Implantação, Configuração, Correção de dados, Dúvidas, Relatar problema, Backup e encerramento, Integração e treinamento e Sugestão de melhoria. Essa lacuna de desenho agora pode ser trabalhada como **proposta versionada**, com os rótulos do documento e a correspondência com códigos internos — não como prova de que as quatro novas categorias já existem no GEO ou de que seus SLAs foram aprovados.

## 5. Pontos que não devem ser aceitos literalmente

As decisões abaixo são a proposta técnica desta revisão. Elas não alteram políticas existentes ou dados de produção por efeito deste documento.

| Ref. de decisão | Passagem do levantamento | Conflito / risco | Tratamento no plano |
|---|---|---|---|
| D01 | Master vê todos os chamados da construtora; obras “todas” | Papel pode virar bypass de recursos; conflita com A/B sem C | Conjunto integral explicitamente concedido pela autoridade; nenhum wildcard de UI ou role ignora ACL |
| D02 | Desativado perde acesso no login seguinte | Sessão atual pode continuar acessando dados | Preservar revalidação por operação/versão e revogação; não aguardar novo login |
| D03 | MFA da equipe só na Fase 2 | Regressão frente ao controle sensível/administrativo existente | MFA obrigatório onde já exigido; completar auditoria de leitura sem rebaixá-lo |
| D04 | E-mail verificado resolve acesso direto ao GEO indisponível | Posse da caixa não comprova identidade ou vínculo à conta | Canal limitado de assistência de acesso, sem leitura de tickets, criação de pessoa ou recuperação automática por e-mail |
| D05 | Contexto/SSO dependem só de parâmetros no link | Link não é fonte confiável de conta/obra/perfil | Identidade e recursos no servidor; link pode portar contexto mínimo não sensível ou referência opaca, sempre revalidada |
| D06 | Encaminhado ao desenvolvimento sai do SLA de solução | Pode apagar violação ou aparentar resolução | Manter solução e violação; cadência de atualização/correção separada. Regra comercial de pausas precisa de aceite |
| D07 | Reabertura “reinicia” o SLA | Zera o esforço/violação anterior | Episódio novo sem apagar histórico, conforme política publicada |
| D08 | Campos sem correspondência viram descrição | Pode publicar dado interno ou privado e perder estrutura | Snapshot anterior preservado; mapeamento explícito e quarentena interna para não mapeados; revisão do cliente quando apropriado |
| D09 | Aprovação automática se solicitante é master | Retira segregação em ação sensível | Permitir apenas se política explícita autorizar autoaprovação para aquela operação; nunca regra universal |
| D10 | 28 dias obrigatórios no padrão de moldagem | Mistura materiais/ensaios e regra técnica não qualificada | Ensaios/idades/unidades conforme material, contrato e responsável técnico; o Help Desk não fixa idade universal |
| D11 | Protocolo continua o legado | Não há inventário do último número, colisões e escopo | Cutover específico, referências históricas e testes de sequência; não renumerar protocolos já emitidos |
| D12 | KB vem depois, mas BC01/02/04/06 são MVP | Contradição interna de prioridade | Orientação mínima curada junto aos formulários; carga ampla e autoatendimento avançado paralelos/posteriores |
| D13 | 171+50 “só precisam de formato” | Ignora quarentenas, ressalvas e fontes internas do HDW-00b | Curadoria explícita, tratamento pelo custodiante e preservação de versões; nunca ingestão pública integral |
| D14 | Planilha, DWG, vídeo e “qualquer formato” | Implementação atual não qualifica esses formatos todos | Pipeline e limites por formato; não anunciar implantação sem seus anexos reais ou alternativa aprovada |
| D15 | Cadastro 1d, dúvidas/problemas/backup 3d, implantação 7d | Há fontes divergentes e “a definir”; não são políticas aprovadas | Catálogo preserva valores como proposta e localizador; validar primeira resposta/solução/calendário/pausa antes de publicar dueAt |
| D16 | Download 3 dias úteis e desativação após entrega | Prazo comercial é diferente de URL curta; entrega não autoriza desativação | Grants curtos renováveis, prazo comercial separado e ação explícita auditada na origem |
| D17 | Problema encaminhado como motivo de finalização | Encaminhamento pode mascarar solução inexistente | Registrar encaminhamento sem finalizar; motivo final compatível com estado e evidência |
| D18 | “Isso resolveu” conta como solução por autoatendimento | Métrica pode insinuar causalidade não medida | Nomear autodeclaração de ajuda; não inferir ticket evitado, SLA cumprido ou causa resolvida |
| D19 | Ações em massa e mescla preservam conversas | Pode misturar audiências de obras/contas | Autorização por item, intents independentes, resumo de efeitos, causa comum separada de conversa privada |
| D20 | IA cita wiki e diz “hoje não existe” | “a confirmar”, legado e conteúdo vencido não são verdade atual | Usar somente fonte qualificada por versão/contexto; ressalvas e indisponibilidade visíveis, sem promessa de prazo |

Prazos exemplificados (7 dias para reabrir, 75% para alerta, 5 dias para atualizar bug e duração aproximada de piloto) permanecem propostas. Não são valores semeados. Grupos, telas, parâmetros e regras de obras inativas dependem de confirmação do contrato da origem.

## 6. Reaproveitamento — o que não refazer

- **Identidade e contexto:** identity/external-session/resource-access, MFA e capacidades. Completar diretórios/stores/IdP, não criar autenticação por e-mail ou token de conexão no browser.
- **Cadastros e formulários:** DSL, form-catalog, padrões de tabela/repeater, draft e intake. Completar catálogos, estados persistidos e UI; não uma tela codificada para cada material.
- **Atendimento:** support-workflow, eventos, SLA, revisão, aprovação e on-behalf. Acrescentar checklist, motivos e metadados de origem nos contratos versionados.
- **Entrega:** anexos privados, stream/scan, outbox/ledger, templates e unknown. Completar fornecedores, filas e persistência; não simular “e-mail entregue”.
- **Consulta:** portal/filas/export/knowledge. Completar SQL/metadata/ACL antes de contadores; não filtrar páginas públicas no browser.
- **Publicação:** manifesto/piloto/contingência, evidencia canônica e CI. Não apagar os gates ou importar relatórios antigos para a fonte nova.
- **HDW-00/00b:** preservar a auditoria editorial produzida, mas não continuar ampliando esse subsistema como pré-condição de todos os cadastros. A quarentena bloqueia sua própria ingestão, não substitui os demais requisitos do produto.

## 7. O que falta detalhar na fonte e foi explicitado como complemento técnico

O levantamento não define contratos reais de API/claims/recursos; dados persistidos e migração; CAS e isolamento das atualizações; semântica de confirmação perdida; revisão das aprovações; origem e cadeia de análise dos arquivos; políticas de retenção; medição de capacidade; custos; restauração; owners/coorte; acessibilidade observável ou testes de segurança diretos. Esses itens já aparecem no planejamento técnico anterior e permanecem no plano V2 como requisitos complementares — não atribuídos ao Claude.

A próxima validação de produto precisa esclarecer matriz de alçada, acesso institucional completo, janela de reabertura, prazos, três estados de revisão editorial e política de chamados da obra. A qualificação técnica precisa verificar IdP/API e semântica de concessão/revogação. Nenhum teste sintético pode resolver essas decisões por si só.
