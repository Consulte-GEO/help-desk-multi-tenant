# M1-R2 — Diagnóstico privado de runtime

## Base e objetivo
Base remota inspecionada: b9481b9fabde2fd9c442e44099bc17608b59571a, branch codex/m1-reproducibilidade. A fonte executável foi reconstituída e conferida pelo fingerprint canônico 94e6b61079895d992209ec14ced701199d0622d24fa704b6495f8b62fc25800a. Os 1.045 testes de aplicação foram repetidos neste ambiente. A API/interface permanece 0.19.0 e o schema 0.18.0.

Entregar um diagnóstico que possa validar configuração e banco sem ativar HELPDESK_RELEASE_APPROVED. Não criar uma rota pública nem executar tickets, autenticação, rate limiting ou operações administrativas. O diagnóstico não fecha M1 nem autoriza produção.

## Contrato
1. Extrair a validação de configuração para módulo próprio. A função existente validateRuntimeConfig continua exigindo releaseApproved === 'true' ANTES de validar qualquer configuração. Nenhuma alteração de flag é permitida pelo diagnóstico.
2. Configuração malformada, inclusive percent-encoding inválido, tipos inesperados e controles, deve produzir erro seguro; não URIError/TypeError com dados sensíveis. Manter URLs TLS sem parâmetros de sobrescrita e papel helpdesk_app.
3. CLI runtime:preflight sem opções faz apenas verificação offline e não importa pg nem acessa rede. Somente --connect pede verificação de banco. Valores são lidos do ambiente, nunca de argumentos; não carrega .env implicitamente e não escreve arquivos automaticamente.
4. No modo conectado: pool exclusivo, máximo 1 conexão, timeout de conexão/consulta de 5s, TLS com rejectUnauthorized:true e CA configurada. Confirmar socket TLS criptografado/autorizado antes de executar SQL. Não inferir o TLS cliente–pooler de pg_stat_ssl.
5. O probe do banco usa uma única conexão em BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY. Verifica o estado read-only e reutiliza os guards existentes de papel, schema e segurança, sem reimplementá-los. SET LOCAL de timeouts é transacional. Termina em ROLLBACK também em caso de sucesso.
6. Falha em qualquer passo, rollback ou encerramento impede resultado positivo. A conexão exclusiva é descartada ao terminar. Sem retries automáticos, alteração de grants, migration ou bypass de TLS/RLS.
7. Relatório JSON tem apenas vocabulário fechado, identificação do tipo de verificação e estados por etapa. Não inclui URL, senha, token, CA, SQL, stack, usuário ou dados de chamados. Registra production_approved:false, operational:false, auth_tested:false e hosted_function_tested:false, inclusive quando o banco passar.
8. Novos testes SQL usam somente o servidor local descartável protegido pelos guards já existentes. Não executar a suíte contra Supabase hospedado.

## Fora do escopo
M2, SLA, anexos, dispatcher, conectores, login real e provisionamento remoto. Nenhum push, PR, deploy, segredo, usuário, MFA ou dado remoto será alterado por esta rodada. O handoff remoto registra autorizações históricas que não são ampliadas aqui.
