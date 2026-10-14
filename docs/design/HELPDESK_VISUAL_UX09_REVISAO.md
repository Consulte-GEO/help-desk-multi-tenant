# UX09 — revisão do cumulativo e integração do frontend

Data de trabalho: 13/10/2026, America/Sao_Paulo. Os logs podem estar em UTC no dia 14.

## Conclusão

UX01–UX08 tinham componentes e verificações locais, mas não comprovavam a composição com o controlador real e o CSS legado. A UX09 passa a executar o `app.js` integral, suas dependências originais e as 19 ligações cumulativas. Corrigiu três defeitos de produto e dois verificadores estáticos que estavam incompatíveis com a evolução do cumulativo.

A frente principal foi validada offline com transporte simulado. O build estático foi executado com todas as dependências copiadas pela lista original, mais os assets cumulativos. Isso NÃO fecha homologação de backend, PostgreSQL, Auth hospedado, HTTP/CSP ou operação real.

## Achados de produto e correções

| ID | Causa observada | Correção | Prova |
|---|---|---|---|
| UX09-01 | Lista e detalhe abreviavam o identificador apenas pelos primeiros oito caracteres. Dois chamados de prefixo igual ficavam indistinguíveis. | Exibir prefixo e sufixo; o cartão mantém UUID completo no nome acessível e no título do identificador. Não inventar protocolo. | Cenário `identificadores`, antes falha e depois passa. |
| UX09-02 | O modo de nota trocava rótulo, ajuda e botão, mas não o placeholder do campo. | Placeholder acompanha o canal público/interno, sem alterar o valor nem os rascunhos. | Cenário `rascunhos`, incluindo alternância e retorno ao mesmo chamado. |
| UX09-03 | GET negado ocultava detalhe e limpava conversa, mas retinha cabeçalho, descrição, contexto e campos operacionais no DOM; a lista continha a projeção anterior. | Em 401/403/404, limpar projeção e formulários; invalidar cache da lista sem novo GET automático. Atualizar explicitamente obtém nova consulta. Falha transitória 503 não apaga rascunho. | Cenários `revogacao`, `detalhe-nao-encontrado`, `falha-temporaria` e `saida-tardia`. |

A abreviação de UUID não é uma garantia matemática de unicidade; a forma completa continua acessível no cartão. Não mudar o identificador da API nem substituir o protocolo de negócio de outras telas.

## Verificadores corrigidos

As verificações UX02 e UX03 exigiam que `inboxUX.reset()` fosse literalmente a primeira instrução de `clearSession()`. A UX08 havia adicionado `accessUX.reset()` antes dela. O aplicativo executava ambos, mas os verificadores recusavam a composição. Agora verificam as chamadas dentro do trecho de limpeza, mantendo os controles de apresentação e a indicação de que a verificação estática não é homologação. O teste histórico UX03 continua aceitando o checkpoint UX03, sem exigir um módulo UX08 inexistente naquela etapa.

Foi adicionado `scripts/visual-integration/check-assets.mjs`: inspeciona arquivos e referências literais de HTML/CSS/JS no `dist`; rejeita import ausente, arquivo privado inesperado e asset externo. Não é parser JavaScript completo nem inspeção de cabeçalhos HTTP. Cinco testes cobrem o verificador, incluindo palavras `from`/`to` como dados, que não devem virar imports.

## Método de teste

`scripts/visual-integration/browser-check.py` executa a aplicação principal integral. Não substitui `app.js` por fixture e não altera o estado interno diretamente. `transport.py` fornece DTOs, erros e respostas atrasadas sintéticas aos controladores reais. Dados, senhas e tokens da bancada são fictícios.

A política do navegador bloqueou a navegação HTTPS/HTTP da bancada. `runtime.py` executa em `about:blank`: reescreve SOMENTE endereços de import para módulos `data:`, expande CSS/imports locais, converte logotipos para dados locais e provê `crypto.randomUUID` apenas nesse contexto quando ausente. Fetch é um transporte simulado com `Response` nativa. Teste de renovação avança o relógio somente na bancada. Não modificar políticas do Chromium nem levar esses adaptadores ao runtime.

## Estados de validação separados

- Implementado: correções UX09 e composição do frontend com 24 edições reversíveis.
- Testado localmente: testes Node do subconjunto recuperado, build estático, referências de saída e sintaxe.
- Testado em navegador: aplicação integral com transporte simulado; regressão isolada UX04–UX08.
- PostgreSQL real, Auth hospedado, HTTP/CSP, CI do checkout completo, deploy, homologação e operação: NÃO qualificados nesta rodada.

## Restrições preservadas

Sem alterações de Auth, escopos, contratos, migrations, scanner, dispatcher, cálculo de SLA ou liberação operacional. `ADVANCED_ACCESS=false`. Nenhum painel opcional nem callback GEO é montado automaticamente. Nenhuma escrita remota. Nenhuma fonte tipográfica distribuída.
