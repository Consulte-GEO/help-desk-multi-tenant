# v0.12.0 — Jornada de sessão humana (HD-103/HD-105)

Base: 667dfde53fcc38481800935b8b865c178aad8237. Continuidade autorizada no chat; não autoriza publicar ou modificar serviços remotos.

## Objetivo
Fechar a lacuna identificada na revisão v0.11: a interface retinha apenas access_token, não renovava a sessão e não solicitava logout ao provedor. Preservar autenticação/autorizações do backend e os controles de mutações.

## Desenho delimitado
- Transporte de Auth isolado para os três caminhos oficiais já necessários à jornada por senha: password, refresh_token e logout?scope=local. URL oficial/chave publicável validadas. Não implementar novo provedor nem alterar configuração Supabase.
- Sessão apenas em memória. Senha não entra no estado; refresh_token não é exposto em snapshots/DTOs. Renovação sob demanda antes de novas requisições, nunca replay de operações já enviadas. Single-flight por sessão.
- Falha transitória de refresh pausa novas requisições, preservando o rascunho da identidade atual; retry explícito. Token recusado encerra o estado local. Resposta antiga de login/refresh/HTTP não pode restaurar sessão ou limpar sessão nova.
- Sair limpa a tela imediatamente, aguarda eventual refresh/login pendente e tenta encerrar só a sessão corrente no provedor. Falha remota é exibida como não confirmada. Access tokens eventualmente copiados continuam sujeitos ao prazo de expiração do provedor; não há denylist nova no backend.
- Sem localStorage/cookies de sessão próprios, timer de renovação em background, SSO, MFA novo, suporte incorporado ou mudança de senha. Recarregar/fechar a página perde tokens locais; não promete revogação remota nesse caso.

## Entregas/testes
1. Escrever e executar testes de transporte, estados e corridas, observar falha pela funcionalidade ausente.
2. Implementar módulos JS pequenos com declarações TS; testar respostas inválidas, limites, timeouts e destinos autorizados.
3. Integrar formulário, estado persistente de erro/renovação, cancelamento e API sem substituir controles de geração já existentes.
4. Exercitar HTTP de loopback com provedor sintético explicitamente injetado; não chamar isso de Supabase real. Ampliar browser sem remover asserts antigos.
5. Reexecutar base, migrações, typecheck (separando o ambiente), contrato, build, smoke e gates. Entregar logs e status dos bloqueios.

## Critério de conclusão deste incremento
Código e testes locais passam, artefatos completos verificáveis. M1 segue aberto até dependências/PostgreSQL/host/navegador e demais critérios reais. Nenhuma migration: schema permanece 0.9.0.
