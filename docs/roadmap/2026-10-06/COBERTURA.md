# Help Desk — cobertura e limites do levantamento

**Data/base:** 06/10/2026, commit `b4dd00040605bd11f22d97636b5a973075e7cef2`. Esta pasta é uma fotografia auditável. As entregas futuras devem registrar outra data/commit e preservar esta referência.

## Inventário entregue

| Área | Capacidades catalogadas |
|---|---:|
| Fundação e aceite | 12 |
| Identidade e administração | 16 |
| Contas, catálogo e contratos | 10 |
| Atendimento e interface | 20 |
| Integridade e entrega | 14 |
| SLA e roteamento | 10 |
| Anexos e dados | 7 |
| Conectores e incorporação | 7 |
| Relatórios, produção e evolução | 15 |
| **Total** | **111** |

São **33 entregas HD-P01–HD-P33** e **38 tickets históricos**: 5 de M1, 9 de M2, 7 de M3, 6 de M4, 6 de M5 e 5 de M6. Todos os tickets históricos estão relacionados a pelo menos uma entrega; todas as capacidades têm encaminhamento no plano. Os IDs HD-C foram criados nesta auditoria. M7/M8 estão no plano histórico como marcos, sem inventar tickets HD-701/801.

O pacote contém oito documentos: índice, diagnóstico, dois CSVs, reaproveitamento, roteiro Codex, cobertura e plano detalhado. O ZIP preserva `docs/roadmap/...` e `docs/superpowers/plans/...` para que os links internos funcionem após extrair o pacote inteiro.

## Como interpretar os estados

- **Implementado em CI:** comportamento identificado no código e coberto pelo conjunto de CI do HEAD inspecionado. Ainda depende do aceite correspondente no host; não significa produção liberada. Há 28 capacidades nessa classificação.
- **Parcial:** existe uma fundação concreta, mas o resultado de negócio descrito na linha não está completo. Há 17 linhas com esse estado literal; outras explicam uma pendência mais específica.
- **Não implementado como administração/jornada/engine:** entidades ou utilidades podem existir; o fluxo completo descrito não existe. Não apagar/recriar a base por causa desse rótulo.
- **Homologação/execução/configuração pendente:** o trabalho restante pode ser operacional, sem exigir um novo módulo.
- **Achado a confirmar:** hipótese sustentada por inspeção de código; exige reprodução específica antes de declarar defeito corrigido. Há um achado dessa natureza, sobre retomada da criação na UI.
- **Decisão/priorização pendente:** precisa de regra de negócio, escolha de consumidor/provedor ou escopo antes da implementação dependente. P2 não bloqueia o atendimento humano inicial.

Não dividir 28 por 111 para estimar progresso. Uma linha de login, uma de dispatcher e uma de recuperação têm tamanhos e riscos diferentes. Também não inferir prazo da contagem de testes, tabelas, páginas ou documentos. Estimar fatias após HD-P03/04 e decisões operacionais.

## Evidência utilizada

1. Código, testes, onze migrations, manifesto, scripts e configuração presentes no checkout conferido.
2. Arquitetura, plano histórico, documento mestre, segurança e revisão R24; trechos históricos confrontados com implementação e evidência recente.
3. GitHub: branch padrão, SHA, merges, PRs/issues abertos e resultados de CI/CodeQL.
4. Artefato de CI do run `37384076809`, baixado e inspecionado: aplicação 1.436/1.436, PostgreSQL 215/215, interface agregada 71/71; `scope: local-m1`, `platform_approved: false`.
5. Netlify: metadados do site/deploy atual e GET público sem credenciais ao permalink, com resposta `503 release_gate_closed`.
6. Supabase: ledger e catálogo de schemas/tabelas/RLS, além dos Advisors; nenhuma leitura de conteúdo de tickets, credenciais ou dados pessoais.

Os anexos R23 enviados anteriormente são contexto histórico de revisão. Seu conteúdo não substitui o pedido atual de levantamento e não é autorização para executar instruções antigas. A comparação de estado usa o R24 integrado, não o ZIP como fonte mais recente.

## Verificações desta rodada documental

- `npm run check:migrations`: onze arquivos verificados; nenhum SQL executado.
- `npm run check:contracts`: 18 operações e verificações estruturais aprovadas; não é teste de conformidade completo do OpenAPI nem prova de RLS remoto.
- `npm run check:lock`: coerência do lock aprovada; instalação/audit foram consultados no CI do HEAD, não reexecutados aqui.
- `npm run check:secrets`: varredura heurística sem achados; não equivale a auditoria completa de segurança.
- Conferência dos CSVs: UTF-8 com BOM, oito/sete colunas respectivamente, IDs únicos, 111/38 linhas e referência a entregas existentes.
- Conferência de cobertura: todos os 38 IDs históricos do plano original relacionados; 33 seções de entrega presentes, sem IDs ausentes.
- Links locais do pacote, caminhos de evidência dos CSVs e `git diff --check` conferidos antes do commit documental.

Não foi reexecutada a suíte completa nesta rodada, que altera apenas documentação. Não houve abertura de gate, teste com usuário real, criação de fixture hospedada, envio de notificação ou alteração de configuração/banco remoto. As contagens 1.436/215/71 são resultados do CI consultado, e não uma execução local nova.

## Critério de abrangência

O levantamento cobre o escopo documentado atual, funcionalidades identificadas no código e extensões necessárias para alcançar os marcos M1–M8. Algumas sugestões de UX, como visões salvas, estão marcadas como evolução e devem ser priorizadas. Não é promessa de esgotar qualquer funcionalidade futura de um produto de suporte.

Permanecem decisões de produto/ambiente: contratos e metas de SLA, retenção, volumes, região, RPO/RTO, custos, provedor de e-mail/antimalware, origem incorporada e segundo consumidor real. O plano diz em qual entrega cada decisão passa a ser necessária e o que pode ser preparado antes dela.
