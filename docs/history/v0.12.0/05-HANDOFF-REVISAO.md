# Continuidade — Help Desk v0.12.0

Base `667dfde53fcc38481800935b8b865c178aad8237`. Branch local `work/helpdesk-v0.12.0`. Commit final no bundle/manifesto. Leia README, AGENTS, documentos 04 e 16 e plano. Não pressupor repositório vazio ou aprovação de escrita na próxima sessão.

## Sequência

1. Reinspecionar destinos antes de integrar; somente GitHub foi lido nesta rodada. Nenhum deploy/migration/Auth/MFA/segredo alterado.
2. Resolver dependências (`npm run deps:resolve`), revisar lock real/árvore/alertas, repetir npm ci/verify/audit. Não substituir por tipos globais/locks sintéticos.
3. Verificar oito migrations e executar125 casos PostgreSQL 17 descartável (inclui upgrade) com papel restrito. Docker padrão/native somente instalação autorizada não root. Sem banco remoto como fallback e sem apagar banco existente para fazer passar.
4. Homologar o novo ciclo humano usando usuários de teste: senha→`/me`→lista/criação; expiração→uma rotação; duas chamadas simultâneas; refresh inválido/timeout; pausa e retry explícito; logout confirmado/sem rede; cancelar login/renovação; novo login antes de resposta antiga. Confirmar IDs Auth e principal distintos e autorização revogada após refresh. Não confiar em role de JWT metadata.
5. **Definir e testar janela de revogação humana.** O pedido ao provedor é local. Access JWT já emitido pode continuar válido até expirar; o backend não ganhou denylist/check auth.sessions. Não publicar promessa de revogação instantânea. Política MFA/CAPTCHA/SSO e demais fluxos não foi implementada/alterada neste incremento; resolver exigências sem desativar proteções.
6. Rodar `npm run test:ui:local`:32 HTTP+27 browser antigos+5 browser com provedor sintético. O último usa fetch/API controlados, não comprova provedor real/CORS. Revisar pausa, senha limpa, cancelamento, draft, perda de foco, navegação, refresh com token curto, erro antes/depois de dispatch, logout e 390 px. Não contornar bloqueio do navegador.
7. Homologar driver/pooler/TLS/IP/Functions e Auth/CSP/CORS reais. API 0.12/schema 0.9: não criar migration cosmética. Não liberar só o HTML como backend pronto.
8. Rodar homologate:local/check:homologation com evidências e fingerprints. Mínimos753 locais/125 SQL/64 UI, sem skips; aprovação local não é produção. Manter HELPDESK_RELEASE_APPROVED fechado até decisões de destino/capacidade/restore e aprovação explícita. M2 só depois do marco.

## Arquivos de revisão

- `web/human-auth.js`/`.d.ts`: paths fixos, chave publicável, limites de leitura/deadline, expiração e projeção.
- `web/human-session.js`/`.d.ts`: geração, pending single-flight, pausa, cancelamento e saída pendente sem ressurreição.
- `web/session-fetch.js`/`.d.ts`: mesmo domínio, headers não substituíveis, resultado antigo ignorado, nenhuma repetição automática de mutações.
- `web/app.js`/index/styles: formulário/senha, banner persistente, limpeza imediata e mensagem de saída não confirmada. Tokens não persistidos; reload exige login.
- `tests/human-*.test.ts`, `tests/browser-human-session.py`, runner UI, assetcheck HTTP e gates.

## Invariantes

Refresh é autenticação, não autorização. Identidade não é recuperada de metadados confiados pelo cliente. `requestSent=false` só antes de enviar; perda da resposta depois do envio continua incerta. Mesma key/payload mantêm idempotência; uma renovação não submete novamente o formulário. Logout não apaga servidor nem cancela requisição já em andamento. Password/refresh não aparecem no estado público ou nos logs. A UI limpa dados de identidades anteriores; não existe persistência em storage/cookie, SSO, novo MFA, backoffice, logout global ou comunicação entre abas.

753 testes locais incluem mocks/resolução SQL controlada;125 SQL e 32 browser não aprovados. Sem revisão independente, pentest, carga ou restore. Documento16 registra fontes oficiais e limites. O pacote não autoriza publicação.
