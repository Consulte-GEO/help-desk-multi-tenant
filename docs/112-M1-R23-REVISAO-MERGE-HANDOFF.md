# M1-R23 — revisão externa, merge e continuidade

Data: 02/10/2026. Este documento sucede os registros R21/R22 para o estado atual. As decisões arquiteturais de PROJECT_HELP_DESK.md continuam obrigatórias. M1 operacional aberto; M2 não iniciado.

## Resultado efetivo

O PR #2 foi integrado por merge, preservando ambos os pais, em 02/10/2026 às 16:09:25 UTC (13:09:25 America/Sao_Paulo). Commit de merge: `129a434ccb6c5fe035eb67e6384f5801a9a7114f`. Base anterior: `9fa74499f2f81a61de044d5826fbc398c5e167b3`; HEAD revisado: `da331df619492c8eab370fdaeeed41c9ac499057`. A árvore do merge é `f5d8d5f474eab0c1b46dd5f0359ca518ff7c0616`, idêntica à fonte revisada. A branch preferencial de continuidade é `codex/m1-reproducibilidade`. Não reaplicar R20–R22 nem mesclar a branch auxiliar ops.

O Netlify confirmou publicação automática em contexto production do deploy `6abfd737fa35d20008d5eade`, associado ao merge, às 16:09:56 UTC (13:09:56 de São Paulo), estado ready e Function api presente. Trata-se de publicação técnica; não é aceite operacional, login real ou comprovação da conexão dentro da Function. Esta documentação é posterior a esse deploy e não altera o fingerprint executável.

## Revisão independente automatizada

A revisão foi solicitada ao Codex no GitHub pelo comentário `5956240386`, com base/HEAD e escopo explícitos. O comentário-resumo do bot `5956244216` registrou conclusão em 16:06:38 UTC para `da331df`; a reação +1 do bot no PR foi registrada em 16:06:42 UTC (reação `541199920`). Esses sinais documentam revisão automatizada separada deste executor e sinalização de ausência de achados. Não houve submissão formal APPROVE em /pulls/2/reviews, revisão humana, pentest ou garantia de ausência de vulnerabilidades. A revisão não foi tratada como aceite operacional.

O merge foi solicitado com expected_head_sha igual ao HEAD revisado, depois da reconferência do PR, dos arquivos, do gate e do preview. Não houve reescrita de história, redução de critérios ou edição dos relatórios para acomodar código diferente.

## CI pós-merge e proveniência

Execução `37031997081`, tentativa 1, commit `129a434ccb6c5fe035eb67e6384f5801a9a7114f`, concluída com sucesso. Artefato `11237484502`, SHA-256 `a854ea503df25189a17dcbc3e887799afb8cd4d1fad527ece8c6e295a96ccb23`. Execução interna de evidência: `cdbe15fb-7b96-4a1b-9de3-4af23df323ab`. Fingerprint executável: `659e9ad6d69d822888486a59b2c9c6bf5d39c7a3ec1391ee29fd048c0e9a6a82`.

Os bytes do ZIP foram conferidos contra o digest do GitHub; o verificador existente aprovou estrutura, fingerprint, contagens e hashes dos seis logs da mesma execução. Resultado: lock, npm ci, audit e typecheck padrão aprovados; 1.436/1.436 Node, 215/215 PostgreSQL 17 e 71/71 HTTP/browser, sem falhas, cancelamentos, skips ou TODO. As 71 verificações são 35 HTTP em memória, 31 Chromium de interface e 5 de sessão com provedor sintético. PostgreSQL é real e descartável no runner; não é o Supabase hospedado. O relatório conserva platform_approved:false.

O artefato pós-merge acompanha o pacote R23 como evidência complementar separada. Os logs R21 já versionados continuam intactos e correspondem ao mesmo fingerprint. Não misturar fases, retocar timestamps, renovar artificialmente a validade nem substituir latest.json só para registrar uma rodada documental. Se a fonte mudar ou a evidência vencer, executar novamente o workflow padrão.

## Verificações locais e limites

Nesta rodada a fonte de 1.291 arquivos foi conferida contra os blobs do snapshot remoto, sem divergência; npm test aprovou novamente 1.436 testes e a regressão focal existente aprovou 19 (subconjunto, não testes novos). O gate existente e as verificações de lock, migrations, contratos e segredos passaram. Não foi acrescentado teste ou comportamento de produto.

A instalação local npm ci falhou com `Exit handler never called!`; não há aprovação local de instalação/typecheck/audit nesta rodada. Uma tentativa GET sem credenciais ao permalink do preview falhou na resolução DNS, sem resposta HTTP. Não foi observado status 200 ou release_gate_closed por essa tentativa. As aprovações do CI real não apagam essas falhas locais.

Não houve consulta ou mutação no Supabase, criação de usuários/recursos, leitura ou alteração de segredos, alteração de permissões de atendimento ou de HELPDESK_RELEASE_APPROVED. Não foi relido o valor atual desse gate. O deploy foi efeito automático do merge, não publicação manual. API/interface 0.19.0, schema 0.18.0, onze migrations e lock preservados; nenhum campo de GeoLab/Financeiro no núcleo.

## Backlog executável — próxima prioridade

1. P0: atualizar o checkout pela branch padrão e ler este documento, PROJECT_HELP_DESK.md e os clientes existentes. Não reaplicar pacotes integrados. Conferir HEAD, alterações concorrentes, origem e validade da evidência.
2. P0: validar site, banco, Auth e outbox do Help Desk diretamente em produção. Preservar os dados existentes; a suíte SQL destrutiva não deve ser apontada para essa base.
3. P0: preparar as fixtures dos exemplos existentes, trocando cada identificador fictício pelo recurso efetivamente criado. Exigir solicitantes A/B, agente A e integração restrita à conta/produto A; duas contas/instâncias, coberturas válidas, chamados e controles positivos de mensagens/notas. Identificar os efeitos de notificação em produção. Não inventar IDs nem ampliar grants para acomodar testes.
4. P0: executar os planos sem rede de test:hosted:read, test:hosted:auth e test:hosted:write. Conferir permalink imutável, netlifySiteName, projeto Auth, commit, hashes e chaves. Após autorização e confirmações explícitas, executar 28 controles de leitura, 12 passos Auth e 43 etapas de escrita humana/M2M com seus controles prévios. Segredos somente no ambiente do processo; não gravar tokens nos arquivos. Não contar controles repetidos como testes únicos.
5. P0: correlacionar efeitos privados no destino autorizado e comprovar TLS/role/schema/RLS/grants dentro da Function, expiração/revogação, concorrência e recuperação sem duplicação. CI e metadados de deploy não substituem essas evidências.
6. P0/P1: medir capacidade e abuso em limites autorizados, ensaiar restauração com RPO/RTO e residência aprovados, completar governança, revisão e aceite operacional. Somente depois avaliar abertura do gate para atendimento real e início de M2.

Cada execução deve registrar separadamente implementado, testado localmente, PostgreSQL real, navegador, deployado, homologado e operacional. Falha de rede ou ausência de dados não constitui aprovação nem motivo para construir outra suíte sintética no lugar da validação hospedada.

## Referências de execução

- PR: https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/2
- Revisão: https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/2#issuecomment-5956244216
- CI pós-merge: https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37031997081
- Deploy confirmado: https://app.netlify.com/projects/helpdesk-consultegeo/deploys/6abfd737fa35d20008d5eade
