# M1-R11 — Aceitação do ciclo básico de autenticação humana e M2M

## Base e objetivo
Continuidade da prioridade P0-AUTH do handoff R10. Base remota R9 `78bbb00112331531168ae24600604cb7f3148770`; R10 local verificado por fingerprint `7d1b3dd3aa7b0361809d9ab750b382f4a171dc7cfb1b597cc189a02fefab7aa2`, baseline 1.241/1.241. Não repetir R2–R9 no remoto. Recuperação local não é história upstream integral.

Criar um cliente de aceitação para login → identidade do Help Desk → renovação → mesma identidade → logout local → refresh recusado, seguido de emissão M2M → identidade → autorrevogação → sessão recusada. Reutilizar `web/human-auth.js`, `createAuthentication` e as rotas existentes; não criar endpoints, tabelas, grants, usuários ou modificar o gate.

## Contrato escolhido
`test:hosted:auth` gera plano sem rede/credenciais por padrão. Execução exige `--execute`, `--allow-session-mutations`, confirmação literal da origem Netlify imutável e confirmação literal da origem Supabase. As confirmações são barreiras de uso, não autorização externa nem prova de homologação do backend. Uma senha humana e uma chave M2M de produção são lidas exclusivamente de variáveis de ambiente do executor. O JSON contém só seletores esperados e não aceita campos extras.

Doze verificações sequenciais: public-config, capabilities, login, identidade humana, refresh, identidade pós-refresh, logout local, recusa do refresh após logout, emissão M2M, identidade M2M, autorrevogação e recusa pós-revogação. Identidades Auth e principal são separadas. /me precisa mostrar exatamente um grant requester da conta autorizada, workspace_role null, escopos mínimos e instância M2M correta. Claims de JWT são somente filtro de recusa; /me e o backend continuam responsáveis pela autorização.

O HTTP fica limitado a HTTPS nas duas origens confirmadas, cinco segundos e 64 KiB decodificados por resposta, sem redirects, retries ou fallback. A chave longa só vai a POST /v1/integration-tokens; a senha só vai a POST /auth/v1/token?grant_type=password. Logout usa exclusivamente scope=local. DELETE /v1/integration-tokens/current só usa a sessão recebida nesta execução, sem corpo ou seletores. Nenhuma rota de mutação de tickets é chamada.

Uma falha bloqueia os passos seguintes. O encerramento tenta, uma única vez, fechar as sessões conhecidas que a execução adquiriu e ainda não tentou encerrar. Não reenvia login, refresh, emissão ou revogação com resultado incerto. Resposta perdida na criação deve aparecer como criação não confirmada; não declarar ausência de sessão. Falha no cleanup reprova o resultado e não é escondida. Uma aceitação indevida de refresh depois do logout é falha, ainda que a sessão inesperadamente devolvida seja encerrada posteriormente.

## Limites de evidência
O relatório não contém email, senha, chave, tokens, corpos ou erros brutos. Contém códigos fechados, status por etapa, correlação do cliente, horários, hash da configuração e origem/commit declarados. Transporte injetado é rotulado injected. Aprovação de plataforma, operacionalidade, browser, expiração temporal, rotação/revogação da chave longa, carga/restore permanecem false. Logout não atesta invalidação imediata do access JWT humano. Uma resposta 429/5xx ou erro de rede não conta como prova de revogação.

Contrato atual do core: uma sessão M2M revogada que deixa de resolver resulta em 403/membership_required. O cliente testa essa recusa específica, não muda o backend para esperar 401. Fonte: `src/infrastructure/authentication.ts`.

## Critérios de saída
Testes negativos antes do código; cenário completo com transporte/handler/autenticação reais e armazenamento/identidade sintéticos; teste de socket local; plano CLI sem rede; proteção de destinos, credenciais, respostas, identidade e cleanup; regressão completa; integridade de migrations/lock; registro separado de qualquer execução hospedada futura.

## Fontes externas e o que não provam
Documentação Supabase consultada em 30/09/2026: https://supabase.com/docs/guides/auth/sessions e https://supabase.com/docs/guides/auth/signout . Há exceções de reutilização de refresh; não exigir invalidação imediata de um refresh anterior à rotação. Signout local preserva outras sessões e access JWT pode continuar válido até exp. As fontes não comprovam o funcionamento do nosso destino. O índice changelog.md foi tentado e recusado pelo leitor por tipo text/markdown; não se declara revisão completa de changelog.
