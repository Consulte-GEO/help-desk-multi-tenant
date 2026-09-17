# Help Desk v0.12.0 — estado e evidências

**Entrega local, não publicada. M1 aberto.** Base v0.11.0 `667dfde53fcc38481800935b8b865c178aad8237`; branch `work/helpdesk-v0.12.0`. Logs UTC de 17/09/2026. Commit final acompanha manifesto externo e bundle.

## Implementação

Jornada humana da interface: transporte limitado de senha/refresh/saída local no provedor, sessões em memória, rotação sob demanda compartilhada entre chamadas, pausa e retry explícito, geração contra respostas atrasadas, limpeza local imediata e resultado remoto da saída visível. Token/refresh não são persistidos no navegador. Cada operação de negócio é enviada uma vez, sem replay automático. Nenhuma alteração na autorização do backend, M2M ou nas migrations.

**API/interface 0.12.0, schema candidato0.9.0.** Oito migrations intactas,23 tabelas candidatas e 18 operações em 14 caminhos. As três rotas usadas pertencem ao provedor Auth, não são novos endpoints do Help Desk.

## Resultados efetivos

| Verificação | Resultado e alcance | Evidência em `evidence/v012/` |
|---|---|---|
| Base reproduzida |710 aprovados antes de implementar |00-baseline-tests.txt|
| Suíte local final |**753 aprovados,0 falhas/skips/cancelados**,43 novos |final-tests.txt|
| Cinco testes de HTTP adicionais |Aprovados e já contidos nos 753; provedor sintético, domínio memória, resolução SQL controlada |08-http-synthetic.txt; final-tests.txt|
| Smoke HTTP existente |**32 checks aprovados**, memória e dados fictícios; inclui módulos JS novos servidos |final-ui.txt|
| Migrações |8 arquivos inalterados por hash; nenhum SQL executado |final-migrations.txt; migration-integrity.json|
| TypeScript global suplementar |Aprovado com compilador/tipos previamente disponíveis |final-typecheck-environment.txt|
| Contrato |18 operações/14 caminhos; estrutura/sentinelas, não validação integral OpenAPI |final-contracts.txt|
| Sintaxe/build |23 JS/MJS e ASTs Python verificados; assets estáticos criados |final-syntax.json; final-build.txt|
| Scanner de segredos |Nenhum padrão reconhecido; não é auditoria completa |final-secrets.txt|
| Verificação padrão |**Falhou com código2**, após753 testes; dependências/tipos locais ausentes |final-verify.txt|
| Homologação/publicação |**Bloqueadas**, não aprovadas |final-homologation.txt; final-release.txt|

A execução TypeScript suplementar utiliza tipos Node globais diferentes dos fixados no package.json. Não substitui `npm ci` nem aprovação do comando padrão. Código e números recuperáveis nos logs, com limites do teste explícitos.

## Ciclos e correções da revisão

- Estado: primeiro teste falhou na importação dos módulos ainda ausentes, não em21 asserções comportamentais já executadas (`01-session-red`). Depois o conjunto passou.
- Transporte:12 passagens e2 falhas reproduzidas. Corrigidos comprimento comprimido versus corpo decodificado e cancelamento de leitura pendente após deadline (`03`→`04`).
- Falha antes de envio:1 falha reproduzida; wrapper marca somente recusas anteriores ao dispatch como não enviadas; erros de rede posteriores não recebem essa marca (`06`→`07`).
- Token com validade curta:1 falha reproduzida por rotação logo após login; margem adaptativa evita chamadas desnecessárias (`10`→`11`). Não é recomendação para configurar validade curta em produção.
- UTF-8/JSON malformado:1 falha reproduzida; classificado como sessão incompatível, não falha transitória que convida retry de token já consumido (`13`→`14`).
- Typecheck encontrou inferência de headers e acesso direto ao campo privado de fixture; testes passaram a usar tipagem explícita e `snapshot()` público (`09`→`12`). Nenhum assert de autorização removido.
- Revisão local de integração/erros/artefatos; **sem revisor independente ou subagente**, sem pentest/carga/restore.

## Bloqueado ou não executado

**Dependências:** `npm run deps:resolve` retornou EAI_AGAIN registry.npmjs.org. Sem lock real, instalação limpa/audit. Nenhum registry alternativo, proxy ou política modificada. Uma tentativa de obter tarball oficial também foi recusada pelo ambiente e abandonada, sem contorno.

**Banco:** o runner recusou Docker ausente antes de conectar. Permanecem **125 cenários SQL escritos,0 executados** nesta sessão. Nenhuma mudança nos cenários, schema, grants, RLS ou backups. Não foi usado Supabase remoto como teste descartável.

**Browser:** o runner concluiu os 32 HTTP e bloqueou em `page.goto` com ERR_BLOCKED_BY_ADMINISTRATOR. A nova suíte humana foi tentada isoladamente em uma demonstração própria e bloqueou no mesmo ponto (`final-human-browser.txt`). **32 checks browser escritos =27 anteriores+5 novos;0 aprovados.** Mock de Auth não foi utilizado para contornar a navegação bloqueada. Sem validação DOM/visual/mobile/acessibilidade.

**Destino:** Supabase Auth real, refresh/expiração/saída, janela dos JWTs, CORS/CSP, pooler/TLS/IP, Functions com pg instalado, capacidade/carga e restauração não foram homologados. Logout no provedor não garante invalidação imediata de JWT emitido: documento 16 explicita a limitação. Sessão pausada preserva dados já carregados daquela identidade, não cria autorização nova.

## Efeitos externos e sequência

GitHub foi consultado somente leitura e retornou repositório vazio. Supabase/Netlify **não foram reinspecionados nesta rodada**. Nenhum push/PR/merge/deploy/migration remota, conta, segredo, MFA ou infraestrutura cobrada foi criado ou modificado.

O incremento cobre HD-103/HD-105. M1 continua aberto; M2/backoffice, anexos, SLA operacional, notificações e conectores reais continuam ausentes. Gate753 locais/125 SQL/64 UI exige aprovações efetivas, não testes escritos. Próximo passo: dependências → banco/upgrade → runtime/identidade real → browser → decisões operacionais. O pacote não autoriza dados reais nem publicação.
