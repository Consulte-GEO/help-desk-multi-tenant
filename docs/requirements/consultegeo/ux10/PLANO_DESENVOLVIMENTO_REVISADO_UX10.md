# Plano de desenvolvimento revisado — Consulte GEO / UX10

**Objetivo:** colocar o Help Desk em condição de atender ao Novo Consulte GEO com interface consistente e fluxos efetivamente integrados. Preservar a arquitetura e os contratos existentes; adiar generalizações que não contribuam para essa operação.

**Referência final desta revisão:** branch operacional `codex/consultegeo-m02`, head documental ca40dfc e fonte qualificada b4a6c90; base visual UX09; API0.29/schema0.22. A CI operacional 264 passou. O cumulativo UX10 modifica essa fonte e precisa de qualificação própria.

## 1. Estado consolidado

| Frente | Estado comprovado | Ainda necessário |
|---|---|---|
| UX01–UX08 | Código cumulativo de identidade, navegação, abertura, portal, administração, operações, apoio e acesso | Regressão no checkout integral e montagem autorizada dos opcionais |
| UX09 | App principal integral e build verificados em bancada de frontend com transporte fictício | HTTP/CSP, fonte completa, CI e aceite hospedado |
| UX10 | Merge dos contratos M09a, estilo das telas M04/M09, callbacks/tipos, replay e build conjunto implementados; testes locais | Integração no PR/branch efetivos e CI de fonte nova |
| M09b | Catálogo e GET/PUT de rascunhos qualificados no relatório144 da fonte b4a6c90; CI264 operacional verde e head documental ca40dfc | Preservar qualificação upstream; integrar consumo/montagem pelas capabilities reais, sem refazer o backend M09b |
| M09c | Prévia/abertura duráveis e seus efeitos foram separados no plano operacional | Implementação/qualificação próprias; não declarar pronto porque existe um adaptador de UI |
| Origem Novo GEO/M08 | Contratos e fronteiras existentes devem ser preservados | Validar configuração real de origem, escopos e identidade no ambiente de aceite |
| Infra de entrega/M11 | Componentes preparados em frentes anteriores | Armazenamento privado, scanner, calendário/SLAs e worker de notificação reais |
| Piloto/M12 | Não homologado por esta rodada | Aceite funcional e operacional da equipe Consulte GEO |

## 2. Prioridade imediata — UX11/G0: integrar a fonte final

### Tarefa 2.1 — reconciliação e origem exata

Arquivos: `AGENTS.md`, `PROJECT_HELP_DESK.md`, `MANIFEST.json` desta entrega, estado do PR31 e árvore corrente.

Conferir a branch e preservar ca40dfc e commits posteriores. A fonte de código verificada permanece b4a6c90. Comparar alterações de `web`, `shared`, `scripts`, contratos e manifesto antes de aplicar. Não resetar a branch operacional para a referência antiga. Se algum contrato divergir, fazer port revisado; não editar hashes para aceitar a divergência automaticamente.

Aceite: relatório de base/head, arquivos em conflito e resolução adotada. CI histórica deve ser identificada pelo SHA; nenhuma evidência de fonte diferente é renomeada como atual.

### Tarefa 2.2 — aplicação do cumulativo

Arquivos: `tools/apply_ux10.py`, `changes/`, `integration/web/app.js`, `patches/app-ux09-edits.json`.

Criar branch isolada e limpa a partir da fonte operacional selecionada. Executar primeiro a verificação sem escrita. O pacote contém o cumulativo visual completo, mas depende dos arquivos operacionais revisados. Aceita a fonte operacional íntegra, ou um overlay UX09 completo já sobreposto a contratos operacionais atuais. Combinações intermediárias não são aceitas.

Aplicar; revisar o diff. O app integral deve coincidir com a receita reversível de 24 alterações da UX09. Nesta etapa não foi acrescentado hook ao app. Não copiar `reference-only/` para o repositório real. Não substituir `package.json`, lock, migrations, flags ou arquivos de backend por cópias de bancada.

Aceite: aplicação idempotente, contratos somente leitura sem mudanças, nenhuma retirada de assets M04/M09, nenhum dado de teste em `dist`.

### Tarefa 2.3 — compilar e validar sem enfraquecer contratos

Arquivos: tipos públicos dos componentes, todos os testes existentes, scripts originais de verificação.

Rodar `npm test`, `npm run typecheck`, `npm run verify`, `npm run integration:check`, build e inspeção dos assets. Manter `strict`, limites, `If-Match`, idempotência e verificadores de segurança. Corrigir diagnósticos na origem; não remover testes ou substituir tipos por `any` para obter aprovação.

Executar os novos testes UX10 e todos os testes existentes de dynamic form/intake/configuração. Verificar explicitamente `onChange` de estado versus `onChange` de respostas, primeiro rejeitado versus replay rejeitado, e respostas tardias ao mudar ação/audiência.

Aceite: comandos da fonte completa aprovados, sem skips não justificados. O typecheck focal desta entrega não substitui esse passo.

### Tarefa 2.4 — CI, banco e publicação técnica

Executar a pipeline original de homologação sobre o merge efetivo. Usar PostgreSQL descartável segundo os scripts existentes. Preservar a correção M09b de b4a6c90; não reintroduzir a migration com hash da revisão 1c6aa7e que falhou no run262.

Conferir build, imports, tipos MIME, CSP, redirects, CSS e logos no preview hospedado. Confirmar login simples e fronteira readonly com atendimento fechado. Revisão independente do diff e da evidência é necessária na integração; esta sessão não utilizou revisor independente.

Aceite: CI e evidência canônica vinculadas à fonte compatibilizada, smoke HTTP hospedado e aceite visual. Publicação técnica não autoriza abrir o atendimento. A aprovação de ativação operacional é um passo separado.

## 3. Próxima etapa funcional — M09b consumo autorizado e M09c abertura durável

### Tarefa 3.1 — ligar discovery e rascunho ao host autorizado

Arquivos principais: `web/consultegeo-request.js`, `web/consultegeo-intake-api.js`, `shared/consultegeo-request.js`, host de portal corrente, readers nativos M09b.

Consumir somente catálogo retornado pelo backend para a identidade, conta e conjunto de referências atual. Fixar formulário/versão recebidos, sem derivar permissão da opção selecionada. Ligar GET/PUT de rascunho conforme capabilities reais. Não passar objetos da fixture da bancada para produção.

Restringir troca de ação enquanto houver salvar/consultar prévia/enviar/resultado incerto. Ao trocar conta/obra/identidade, limpar componentes e invalidar respostas pendentes; não transportar rascunhos entre contextos. Mudança de revisão exige nova leitura e confirmação.

Aceite: catálogo limitado corretamente antes da paginação, nenhum rascunho de outra conta, retomada vinculada à observação vigente, leitura e salvamento autorizados por servidor; ausência da origem exige recusa segura, não fallback fictício.

### Tarefa 3.2 — qualificar prévia e criação M09c

Arquivos candidatos conforme arquitetura: `src/application/support-intake.ts`, `form-draft.ts`, perfil Consulte GEO, loja nativa de intake, handlers/runtime e testes PostgreSQL existentes. Confirmar os nomes na árvore corrente, sem criar um segundo fluxo paralelo.

Implementar a prévia e a criação duráveis como etapa própria, iniciando por Incluir usuário, conforme o relatório144. Não tratar as cinco ações como operacionais sem as fontes de lookup/arquivo respectivas. Reservar protocolo, snapshot imutável, auditoria, marcação de draft e outbox na mesma transação conforme o contrato. Fixar política/calendário/versão que produziram o resultado; não recalcular silenciosamente após troca de configuração.

Revalidar revisão, identidade, escopos, cobertura e evidências antes de gravar. Se não houver lookup/arquivo qualificado, negar o fluxo que depende desse recurso. Ausência de recibo confiável mantém a intenção desconhecida; não repetir mutações automaticamente nem gerar outro protocolo.

Aceite negativo: perda de ACK, pedido repetido, dois agentes/duas abas, alteração de cobertura/versão entre prévia e confirmação, autorização revogada, escopo de outra conta, falha parcial em efeito obrigatório e revisão contraditória. Deve haver um único efeito/protocolo ou rollback comprovado. Notificação permanece pendente até sua própria evidência.

### Tarefa 3.3 — composição browser/HTTP/banco

Exercitar a jornada completa com backend e identidade de teste autorizados, sem substituir o app/controlador. Cobrir cliente, equipe, supervisor e usuário sem acesso; erros, conflito e indisponibilidade devem produzir estados distinguíveis.

Aceite: abrir, retomar, revisar, confirmar, consultar, responder, aprovar/corrigir e concluir no ambiente designado. Cada ação preserva isolamento e registra evidência adequada. Escrita em ambiente real somente com autorização e plano de limpeza; nunca transformar um smoke readonly em teste de gravação silencioso.

## 4. M11 e M12 — fechamento operacional

Qualificar Storage privado e scanner antes de aceitar anexos reais. Validar links temporários e autorização no momento do download. Qualificar calendário e fuso da política publicada, sem converter as horas de exemplo da bancada em regra de produção.

Validar fila/outbox, worker e provedor de notificação, distinguindo aceitação, entrega, supressão e falha. A ferramenta não deve informar e-mail enviado apenas porque registrou o chamado.

No piloto Consulte GEO, executar seis serviços: acesso de usuários, dúvidas, backup, implantação de obra, ajuste de estrutura e problemas. Usar cenários autorizados e dados fictícios ou controlados. Registrar aceite do solicitante, da equipe e do responsável pela operação; confirmar rollback e observabilidade. Só então avaliar a liberação de atendimento para a coorte aprovada.

## 5. Política de entrega das próximas rodadas

Cada rodada mantém ZIP cumulativo, handoff, plano revisado e estado por recurso: implementado, testado localmente, testado em PostgreSQL, testado no navegador, deployado, homologado e operacional. Componentes opcionais não entram como operacionais sem host/capability e backend reais.

Não abrir novas frentes cosméticas independentes antes de encerrar a integração desta fonte. Não duplicar M09b nem restaurar antigas migrations/checkpoints. A prioridade passa de “mais telas isoladas” para “fonte compatibilizada, evidência completa e percurso de atendimento real”.
