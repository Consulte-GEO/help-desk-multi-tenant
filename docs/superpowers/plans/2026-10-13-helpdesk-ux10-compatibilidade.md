# Plano executado — compatibilidade UX10

> Execução inline em cópia local isolada. Sem subagente ou revisão independente nesta sessão.

**Objetivo:** compatibilizar UX09 com a operação Consulte GEO e adaptar a jornada de solicitação/configuração já existente.

**Arquitetura:** renderer compartilhado e controladores existentes. Mudanças restritas à apresentação, notificação de estado, preservação de intenção e composição dos assets. Dependências operacionais são conferidas, não substituídas.

**Referência:** `docs/design/HELPDESK_VISUAL_UX10_COMPATIBILIDADE.md`.

## Registro da execução

- [x] Comparar bases e ler mudanças concorrentes em build, renderer, intake, timeline e telas nativas.
- [x] Reproduzir onze regressões de compatibilidade antes das correções T1.
- [x] Compatibilizar contratos de callbacks/canEdit e conciliação sem remover UX01–UX09.
- [x] Reproduzir quatro problemas de composição antes das correções T2.
- [x] Adaptar jornada e editor nativos; preservar dados se construção do adaptador falhar.
- [x] Corrigir herança de rótulos escuros e hierarquia da ação de cancelar após prova em navegador.
- [x] Isolar callback de estado nos tipos públicos após erro TypeScript reproduzido.
- [x] Remover identificação fixa de release antiga no shell após teste reprovado.
- [x] Validar transporte real de sessão/API com respostas fictícias, sem prefixo `/v1` duplicado.
- [x] Rever o avanço para b4a6c90 e a nova CI bem-sucedida, sem atribuí-la ao UX10.
- [x] Implementar aplicador de dois checkpoints coerentes, com contratos somente leitura e rollback local.
- [ ] CI completa da composição visual + operacional, PostgreSQL, HTTP/CSP e aceite hospedado.

## Regras de integração

A referência final é b4a6c90. O pacote não pode ser aplicado à base antiga sem os contratos operacionais. O aplicador deve recusar mistura de estágios, mudanças concorrentes nos arquivos tocados, deriva das dependências e escrita em branches compartilhadas. Não executar migrations ou publicar nesta etapa.

A próxima sequência executável está no `PLANO_DESENVOLVIMENTO_REVISADO_UX10.md` da entrega. M09b não equivale à abertura durável M09c e CI verde da branch anterior não qualifica uma composição nova.
