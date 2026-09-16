# M1b — Verificação local, limites e prontidão

## API 0.3.0, schema 0.2.0

A versão da API/interface é 0.3.0. As quatro migrations anteriores não foram modificadas; o runtime continua exigindo schema 0.2.0. Não criar/aplicar migration somente para igualar números de versões de componentes distintos.

O contrato HTTP permanece com 14 operações. Novos comportamentos explícitos: 400 para comprimento/UTF-8/parâmetros inválidos, 408 para prazo de recebimento excedido, 413 para corpo acima de 64 KiB e 415 para tipo/compressão não suportados. O prazo da aplicação é cinco segundos e não substitui os limites do provedor. Erros de dependência de autenticação não concedem acesso.

## Executar a homologação local

Pré-requisitos: dependências de package.json resolvidas com lockfile real, Node compatível, Docker local, Python/Playwright/Chromium disponíveis por instalação autorizada. Os componentes Python/browser também precisam de versões aprovadas e reproduzíveis antes de uma aprovação operacional. O executor não instala navegador nem altera políticas do ambiente.

```bash
npm run deps:resolve
# Revisar dependências, integridade, licenças, alertas e diff do lock gerado.
npm run homologate:local
npm run check:homologation
```

`homologate:local` executa a seguinte dependência entre etapas:

| Etapa | Comando | Condição |
|---|---|---|
| lock | `node scripts/verify-lock.mjs` | Lock compatível e origem/integridade verificáveis |
| install | `npm ci --ignore-scripts` | Depende do lock; nunca usa install como fallback no CI |
| audit | `npm audit --audit-level=high` | Depende da instalação |
| application | `npm run verify` | Depende da instalação; testes, tipos, contrato, scan e assets |
| postgres | `npm run test:db:local` | Depende da instalação; Docker local descartável, sem fallback remoto |
| interface | `node scripts/test-ui-local.mjs` | Depende da aplicação; demonstrações frescas separadas para HTTP e navegador |

A etapa de interface exige a porta de loopback 4317 livre. O executor espera a confirmação do próprio processo iniciado; não reutiliza um servidor encontrado na porta e não encerra processos alheios. HTTP e browser rodam em instâncias diferentes para evitar fixtures contaminadas. Esses testes continuam em memória, não equivalem à UI conectada ao PostgreSQL/Supabase.

Cada comando tem limite de execução e saída capturada limitada. Interrupção, saída excessiva, comando ausente ou saída não zero produzem falha. Os subprocessos iniciados pela verificação são encerrados de forma controlada. O executor foi exercitado neste ambiente Linux; portabilidade completa do conjunto Docker/Python/npm precisa de verificação no sistema operacional de desenvolvimento escolhido.

## Evidência e gate

A execução escreve `evidence/homologation/latest.json`, uma cópia por execução e logs em `runs/<identificador>`. As dependências de etapa que falharam ficam `blocked`, nunca `passed` ou omitidas.

Para aprovação local, todas as seis etapas precisam de saída zero, sem sinal de término; aplicação, PostgreSQL e interface precisam de asserções executadas e sem falhas/skips/cancelamentos. Os pisos iniciais do gate são 274, 35 e 20, respectivamente. Não são estimativas de capacidade, cobertura ou contagem de usuários.

O fingerprint SHA-256 abrange código, scripts, testes, migrations, interface, configuração de build e OpenAPI. Arquivos novos nas árvores relevantes também entram; `.git`, dependências instaladas, `dist` e resultados gerados não entram. Mudanças de fonte durante a execução invalidam o relatório. O gate confere hash dos logs, contagem registrada, origem do arquivo, fonte atual e prazo máximo de sete dias; relatório no futuro é recusado.

O registro é **evidência local, não assinatura digital de um serviço independente**. Alguém que controla o repositório pode editar código e fabricar relatórios/logs. Revisão, permissões de merge/publicação e uma cadeia de CI confiável continuam necessárias. Não copiar logs sintéticos dos testes para `evidence/homologation` nem editar status para liberar build.

`verify:release`, já utilizado por `netlify.toml`, passa a exigir `check:homologation`, além de lock, verify e audit. Assim, não basta obter verde apenas nos testes em memória. Um relatório aprovado localmente NÃO libera a variável `HELPDESK_RELEASE_APPROVED`, não comprova bundle Functions e não aprova Auth/TLS/RLS no Supabase real.

O workflow existente contém application e postgres-rls. Um job isolado verde não equivale à nova homologação agregada. A publicação permanece condicionada ao fluxo revisado: evidências completas, revisão das fontes, bundle Functions e homologação do destino. Nenhuma configuração remota de CI foi alterada nesta entrega.

## UX de mutações

Cada envio captura sessão, workspace, pessoa, ticket, canal, revisão do rascunho, corpo e chave de reenvio. Uma resposta só altera o estado que ainda corresponda a essa captura. A conclusão não apaga texto digitado depois; público e interno são independentes. Troca de ticket invalida a operação imediatamente, antes do retorno do GET do destino.

Retry com corpo inalterado conserva chave; alteração do conteúdo representa nova operação e usa nova chave. Fechar uma tela não cancela uma operação já enviada/confirmada no servidor. Em falha de rede com resultado incerto, consultar o recurso é preferível a modificar o corpo e criar intencionalmente outra operação.

Formulário de abertura captura seus campos antes de resolver cobertura; mudanças ou fechamento durante a resolução não são reaproveitados silenciosamente para criar outro conteúdo. Uma operação já enviada ao servidor pode concluir após fechar o formulário; não se promete desfazê-la.

Essas proteções tiveram testes puros e HTTP local. Os dois novos cenários Playwright devem demonstrar a integração no navegador antes de declarar a UX homologada.
