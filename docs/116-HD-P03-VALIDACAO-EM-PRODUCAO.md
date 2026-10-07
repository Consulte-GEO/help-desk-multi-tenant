# HD-P03 — Desenvolvimento e validação em produção

**O Help Desk tem um único ambiente: produção.** Por decisão expressa do usuário em 06/10/2026, todo desenvolvimento publicado, cadastro, implantação e validação hospedada usa os recursos de produção abaixo. Não criar nem exigir outro site, projeto Supabase ou branch de banco. Não voltar a solicitar ambiente, contas ou credenciais de teste ao usuário.

| Recurso de produção | Identificação |
|---|---|
| Site Netlify | helpdesk-consultegeo |
| ID do site | 9781cd85-7dc1-4ef5-868b-947e389a9d4d |
| Projeto Supabase | HelpDesk |
| ID da base/Auth | xaelbntjnvztznnpcvtm |
| URL Auth | https://xaelbntjnvztznnpcvtm.supabase.co |

Esta decisão substitui os pré-requisitos anteriores dos planos e handoffs. Isolamento de acesso entre contas/workspaces continua sendo regra do produto na base de produção. Testes unitários e runners temporários do CI são verificações automatizadas do código; não constituem infraestrutura hospedada do Help Desk. A suíte SQL destrutiva não deve apagar ou recriar a base de produção.

## Ajustes da especificação e dos clientes

Os planos, documentos de segurança e handoffs passam a apontar diretamente para produção. Os três exemplos de site separado foram removidos do Git. Os exemplos mantidos usam `environment: "production"`; IDs fictícios continuam sendo placeholders, sem declaração de cadastro ou aprovação.

Os clientes existentes read/Auth/write passam a validar configuração `production`. A leitura do catálogo espera instâncias `production`, corrigindo a exigência anterior de `staging`. Preservar confirmação de origem, hash de configuração, identidades distintas, limites de resposta, permissões, privacidade e replay. A alteração de configuração muda o hash do plano; recalculá-lo antes da execução. A execução padrão permanece sem rede.

## Continuidade de implementação

HD-P02 corrigiu a recuperação da abertura de chamados: manter payload/chave originais após resultado desconhecido; não resolver cobertura novamente no replay; validar recibo antes de confirmar; informar falha de leitura posterior separadamente. Backend, onze migrations, scopes, grants e lockfile preservados.

[PR4](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/4) reúne a continuidade. CI do commit `e0406384efbc5d3b6c72926bc188913441d9766c`, [run37559337250](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37559337250), aprovou lock/install/audit, 1.447 aplicação, 215 PostgreSQL e 79 interface. Esses números são anteriores à adaptação dos clientes para produção; a nova fonte requer sua própria execução.

O conjunto anterior do [run37558111964](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37558111964) está arquivado em [ci-linux](../evidence/hd-p03/ci-linux/homologation/latest.json): ZIP SHA256 `20985a1b48ebeb43adef257194e042f5a312fd323efc23618bc1fe9f050c9b73`, fingerprint `3941d1685cc71858852df2458191ace9c984d2691e8f30588f722a3725da1bf3`. A cópia exata no gate canônico permitiu construir o PR no Netlify. Falha anterior do run37554188619 foi preservada; o teste de notas passou após esperar a leitura terminar antes de mudar a interceptação de rede.

Deploy automático do PR `6ac5a625c8f15a0008bb68a3`, commit e040638, no mesmo site: ready, quatro arquivos públicos conferidos por SHA256, headers CSP/DENY/nosniff presentes. Public-config respondeu503 `release_gate_closed`, requestId `b54bc81a-5ee2-4af2-a62f-d63e1019549e`. Essa publicação de código não cria site ou banco adicional.

## Configuração e aceite de produção

Os metadados do site indicam banco/CA/chave publicável/HMAC cadastrados; URL Auth coincide com o projeto HelpDesk. A API Netlify oculta os valores secretos, portanto o preflight com conexão real ainda não foi executado por esse canal. A representação oculta não diagnostica a configuração efetiva. Nenhum segredo foi registrado nem variável remota alterada.

A última consulta agregada observou um workspace e uma pessoa humana; zero contas, coberturas, conexões e tickets. Isso descreve a base observada, não exige outro ambiente ou conjunto de usuários de teste. Cadastros administrativos e validação do percurso real devem ocorrer em produção pelos canais privados existentes, preservando dados e autorizações.

M1 permanece aberto enquanto Auth/Function/TLS/papel restrito, efeitos persistentes e recuperação operacional não forem comprovados. Continuar o desenvolvimento e registrar os limites sem repetir perguntas sobre infraestrutura ou credenciais de teste. Não promover CI ou metadados a aceite operacional.
