# Proteção da branch e isolamento de prévias

Configurações aplicadas e reinspecionadas em 17/10/2026, após o primeiro lote de preparação.

## GitHub

A branch padrão `codex/m1-reproducibilidade` exige PR com uma revisão humana, descarte de aprovações após mudanças, aprovação do último push por outra pessoa e resolução das conversas. A base deve estar atualizada e os checks `homologation`, `hda` e `implantation` precisam passar, vinculados ao GitHub Actions (App 15368). Administradores cumprem as mesmas regras; force push e exclusão estão bloqueados.

A resposta real do provedor foi conferida após a alteração. PR76 permaneceu aberto e foi observado bloqueado, sem tentativa de merge. O GitHub App do MCP ainda depende de instalação própria; não foi ensaiada uma recusa com esse App real. Nenhum bypass foi concedido ao MCP.

## Netlify

No site `helpdesk-consultegeo`, `RESEND_API_KEY` e `RESEND_WEBHOOK_SECRET` permanecem secretas e no escopo Functions. Os campos de produção não foram editados. Os contextos deploy-preview, branch-deploy, dev-server (Preview Server/Agent Runners) e dev ficaram explicitamente vazios. O painel confirmou um contexto com valor por credencial, e a leitura posterior da API confirmou os mesmos IDs contextuais de produção. Segredos não foram lidos nem comparados byte a byte.

A equipe ConsulteGEO não possui variáveis compartilhadas. Metadados das outras 23 variáveis foram preservados; a política de deploys não confiáveis continua `Require approval`. As prévias dos PRs ativos foram encaminhadas para reconstrução sem cache após a mudança, com resultados registrados nos recibos administrativos da preparação.

## Limites e manutenção

Configuração nova não saneia retroativamente snapshots históricos. Deploys anteriores não foram excluídos e as chaves do provedor de e-mail não foram rotacionadas nesta tarefa. A produção permaneceu no deploy `6ad3a29338ddf71339a08253`, fonte `0651eb6`.

Antes de liberar escrita MCP, conferir novamente proteção, permissões do App, grants, isolamento dos demais executores e o aceite em duas contas. O piloto de escrita permanece desligado. Este documento é um snapshot administrativo e não substitui reinspeção do provedor.
