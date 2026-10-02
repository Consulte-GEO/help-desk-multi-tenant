# M1-R10 — Aceitação HTTP hospedada, somente leitura de domínio

## Base e prioridade
Base remota lida: `78bbb00112331531168ae24600604cb7f3148770` (R9 integrado), branches `codex/m1-reproducibilidade` e `codex/m1-r9-integracao`. Fingerprint executável `972674dad13427f3d71d6103e60772dd9e0979da5cf27c91adadf2393ba22581`, reproduzido a partir do bundle R8 e dos deltas R9 obtidos pelo conector GitHub. Não é clone da história remota.

O CI 36592018825 da base aprovou 1202 aplicação,209 PostgreSQL17 e71 HTTP/browser. Esses resultados deixam de ser pendências históricas genéricas, mas não validam alterações posteriores. O handoff upstream docs64 prioriza Function/Auth/M2M hospedados. A suíte abaixo implementa a primeira fatia dessa aceitação; não cria endpoint ou diagnóstico de produção.

## Escopo escolhido
Exercitar as rotas HTTP existentes via HTTPS, com quatro sessões previamente provisionadas: solicitante A, solicitante B, agente da conta A e sessão curta M2M restrita à conta/produto A. Utilizar duas contas/produtos sintéticos e chamados/notas/mensagens existentes. Não criar/editar chamados, contratos, usuários ou grants. GET pode incrementar contadores técnicos do rate limiter; somente leitura de domínio não significa ausência de toda escrita SQL.

A alternativa de abrir `HELPDESK_RELEASE_APPROVED` em produção foi descartada. Uma Function de diagnóstico adicional também foi descartada: esta entrega é cliente de testes do contrato existente. A execução completa depende de ambiente de homologação autorizado com runtime habilitado sob governança própria, sem desligar controles do ambiente de produção.

## Contrato e segurança
- CLI padrão imprime plano validado e não faz rede nem lê credenciais. Execução exige `--execute`, confirmação literal da origem e autorização atual do operador para o destino.
- Apenas permalink Netlify imutável: `https://<24 hex>--helpdesk-consultegeo.netlify.app`. Recusar alias de produção, HTTP, credenciais na URL, query/fragmento, subdomínios adicionais, portas alternativas e espaços.
- Configuração JSON estrita, sem tokens. Supabase esperado, commit declarado, UUIDs distintos e marcadores sintéticos obrigatórios. Commit informado é declaração do operador, não prova servida pela API.
- Tokens somente em variáveis de ambiente nomeadas; quatro valores distintos. Humanos usam JWTs de acesso, nunca service_role; máquina somente `hd_session_`, nunca a credencial permanente `hd_key_`. A leitura de payload do JWT serve apenas à recusa de papéis privilegiados, nunca à concessão de autorização.
- Primeiro verificar public-config e capabilities sem bearer. Nunca enviar credenciais se o projeto Supabase/release divergirem ou se o gate estiver fechado.
- Requisições sequenciais, GET exclusivamente, sem retries, redirect desabilitado, TLS padrão do Node sem relaxamentos e JSON decodificado limitado a64KiB/5s por requisição. Reutilizar o leitor limitado existente.
- Validar tipo de conteúdo, no-store, nosniff e correlação. Exceção bruta, Location, corpo, título de chamado, texto de mensagem/nota e tokens não entram no relatório.
- Falha interrompe envio de novas requisições; restantes ficam bloqueadas, não aprovadas. `release_gate_closed` produz bloqueio e não sucesso.
- Uma nota interna sintética precisa ser visível ao agente e um chamado da conta B precisa ser visível ao próprio solicitante B ANTES dos testes negativos; isso impede falsa aprovação por fixture ausente.
- Provar identidade/scopes/grants atuais, tickets A/B positivos, catálogo mínimo autorizado, mensagem pública e nota positiva; depois negações A→B, B→A, máquina→B, workspace negado e notas privadas. Ausência de nota na serialização pública é verificada com marcador e campos proibidos.

## Evidência e limites
Relatório fechado: identificadores dos checks, resultado, status HTTP, código sanitizado, correlação, origem, commit declarado, instante, configuração por hash e classe de transporte. Transporte injetado nos testes é explicitamente `injected`, nunca prova hospedada. Uma suíte verde atesta somente os cenários executados. `platform_approved`, `operational`, `login_lifecycle_tested`, `m2m_lifecycle_tested`, `browser_tested`, `restore_tested` permanecem false.

Não cobre login/senha, refresh, logout, emissão/revogação de M2M, mutações idempotentes reais, cargas/restore ou conexão pg/TLS observada dentro da Function. Esses itens continuam no handoff e não são substituídos pelo resultado desta suíte. Não incorporar o relatório ao gate local como se fosse PostgreSQL/browser.

## Plano de execução desta rodada
1. Recuperar e verificar fonte R9, baseline e migrations.
2. Escrever regressões negativas e de fluxo antes do cliente da suíte; confirmar falhas pela ausência das funções.
3. Implementar cliente/CLI utilizando somente rotas existentes; executar regressões e integração com handler real e memória em loopback.
4. Rodar suíte completa, verificações possíveis e registrar bloqueios reais da toolchain/infraestrutura.
5. Gerar patch R10-only contra fonte compatível R9, fonte cumulativa, evidências e handoff; não publicar remotamente.

## Ajustes confirmados durante a implementação
A autorização existente em `src/domain/policy.ts` restringe solicitantes e integrações à autoria do chamado, mesmo dentro da mesma conta. A fixture final exige **três chamados**: humano A, humano B e integração A. `machineTicketId` e `machinePublicMessageId` identificam o controle positivo da integração. Não ampliar grants nem trocar o perfil por account_manager para fazer o teste passar. As negações integração→chamado humano A e humano A→chamado da integração foram incluídas.

O controle de nota interna precede as leituras de mensagens/timeline e todas as negações de recursos. A flag pública `capabilities.internal_notes: true` é válida e não equivale a divulgar uma nota. O cliente distingue essa flag booleana do conteúdo privado.

A suíte final possui **28 cenários HTTP sequenciais**. Sua regressão possui **39 testes Node**; um deles usa socket HTTP real em loopback, handler real e identidades/memória sintéticas. Os 28 cenários de uma execução não são 28 novos testes PostgreSQL ou 28 provas de Auth hospedado.

A fixture deve ser pequena e completamente retornada em uma página de até 100 itens. `next_cursor` não nulo reprova por fixture incompleta; não se declara isolamento do recorte inteiro a partir de uma página parcial. O workspace negado é um seletor explicitamente não autorizado; sem controle positivo nesse segundo workspace, o caso não prova uma instalação completa de dois workspaces.

## Condições externas que este código não consegue certificar
Um permalink Netlify é imutável quanto ao deploy, mas não prova que o backend associado é de homologação. A propriedade `environment` é declaração do operador. Antes de fornecer tokens, revisar no provedor o deploy, sua configuração e o projeto Supabase efetivo, além da autorização atual para aquele destino. `declared_deployment_commit` também é declarado, e `deployment_commit_verified` permanece false: a API existente não expõe uma atestação desse commit.

O relatório não assina nem atesta sua própria proveniência. Alterações deliberadas por alguém que controla o executor/relatório estão fora dessa proteção. Manter relatório, comando sanitizado, versão do cliente, commit/deploy verificados externamente e aprovação humana no dossiê.
