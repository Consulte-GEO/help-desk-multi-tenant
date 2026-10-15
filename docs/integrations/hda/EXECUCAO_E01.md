# Execução E01 — HD-DA-CADASTROS

**Data:** 14/10/2026. **Plano de origem:** V2.0. **Natureza:** incremento local de código e testes para integração posterior pelo Codex. **Não é entrega operacional nem conclusão dos 14 pacotes.**

## Resumo do incremento

Implementados oito módulos TypeScript aditivos: catálogo de ação piloto, canonicalização restrita, snapshots/rascunhos, contratos de análise, schema de saída, máquina pura de análise, parser de envelope Claude e contrato de prévia candidata. Foram criados oito arquivos de testes Node, fixture de dados sintéticos, vetores canônicos e verificador Python independente.

A análise pode ser exercitada programaticamente em testes: snapshot → job → proposta → rascunho ou complemento/revisão manual. Isso **não** está conectado à abertura real do Help Desk, a um processo Claude, a uma fila durável ou à tela de rascunho. O código não tem função que escreva no Novo GEO.

## Base e alterações concorrentes

GitHub consultado no commit `511523bea50c053a3bf1ac027be7a4ff01414930`, depois da base V2 `78c137f0badb9f56c65b1813f5e9754b9c34b50c`. Os checkpoints recentes registram atendimento e worker de e-mails ativos, API/interface0.31.0 e schema0.24.0/17 migrations; não reutilizar o diagnóstico antigo de core fechado/schema0.19 como estado atual.

O catálogo existente já agrega oito tipos sob Cadastros e acessos. Nenhum deles foi automaticamente habilitado: somente `geo.user.grant_work.v1` possui definição candidata, com execução proibida. Não foram alterados catálogo publicado, credenciais, MFA, políticas, rotas, gates, jobs Resend, wiki, versões de API/schema ou migrations.

## Ambiente e alcance real das provas

As leituras pelo conector GitHub funcionaram, mas o ambiente local não resolveu github.com para clone. Foi criado worktree isolado a partir de **subconjunto**, com `errors.ts`, `canonical.ts` e `tsconfig.json` conferidos por hash Git contra a fonte. O package.json desse ensaio é somente ferramenta local, não substituição do package do projeto. O pacote inclui contexto de reprodução separado do overlay.

Os commits locais registram a evolução desse subconjunto; não pertencem ao histórico GitHub. A aplicação deve usar o patch aditivo/overlay no checkout completo atual, nunca substituir todo o repositório pelo diretório de ensaio.

| Camada | Resultado E01 |
|---|---|
| Testes Node do incremento | 122/122 passaram, zero falhas/skips/cancelamentos/todo |
| TypeScript | Checagem focada do subconjunto passou, usando tsconfig exato da origem |
| Canonicalização independente | 14 válidos + 12 inválidos verificados por Python stdlib |
| Negativo do verificador | Fixture com resultado esperado adulterado recusada |
| Revisão | Autorrevisão separada do autor; não houve revisor independente |
| Regressão integral do Help Desk | Não executada; requer checkout completo |
| Build/check:contracts/check:migrations/check:homologation integrais | Não executados nesta sessão |
| PostgreSQL17/RLS/concorrência real | Não executados; nenhum SQL novo nesta entrega |
| Navegador | Não executado; nenhuma tela implementada |
| Claude CLI e API/IdP .NET | Não executados/qualificados |
| CI remota/deploy/homologação hospedada | Não executados nesta sessão |
| Cadastro/e-mail real | Nenhum disparado |

Os 26 vetores também são usados pelos testes Node; o total independente Python não deve ser somado como 26 novos requisitos de negócio. Contagens de CI registradas pela origem descrevem outros commits, não esta E01.

## Revisão e correções verificadas

A revisão de arquitetura detectou dependência do domínio em conector; um teste de fronteira falhou antes de mover o parser puro para o domínio. Posteriormente, três regressões foram reproduzidas e corrigidas: limite agregado de bytes que só interrompia tarde demais; estado inicial adulterado que aceitava status incompatível; e política inválida em conclusão sem proposta. O conjunto final passou com122 testes. Logs vermelhos e verdes estão preservados.

Nenhum teste/proteção do repositório foi removido para obter aprovação. A limitação é a ausência da regressão completa, não uma afirmação de que ela passaria.

## Decisões registradas

1. Executar HDA-01 e a fatia HDA-05.preview-contract sem inventar origem, PostgreSQL ou CLI. Custo: fila, interface, aprovação e execução continuam próximas entregas.
2. Preservar o estado atual de atendimento/e-mails, diferente da premissa antiga V2. Custo: a futura publicação exige reinspeção hospedada, pois esta sessão não a fez.
3. Adotar perfil canônico restrito e vetores fixos sem declarar conformidade plena RFC8785 ou .NET. Custo: a integração entre linguagens e dados decimais requer prova e evolução próprias.
4. Não montar o domínio no runtime sem persistência/ACL e worker qualificados. Custo: o usuário ainda não verá mudança funcional em produção após somente integrar estes arquivos.
5. Corrigir no acompanhamento os marcos herdados trocados da matriz V2: HDA-04 runner, HDA-05 origem, HDA-11 piloto e HDA-12 IdP. IDs dos81 casos permanecem preservados.

## Continuidade

Ler `PLANO_ATUALIZADO_E01.md`, `MATRIZ_EXECUCAO_E01.json` e `HANDOFF_CODEX_E01.md`. HDA-02 é o próximo pacote de implementação no checkout completo, com qualificação HDA-00 em paralelo. Só o recorte com prova real poderá futuramente ser chamado de operacional.

## Reinspeção final de concorrência

Antes do empacotamento foi observado o novo HEAD `875df195745c950590d851f91eb609e7b98a1119`, merge PR38 (Email Kit, primeira onda). O compare contra `511523bea50c053a3bf1ac027be7a4ff01414930` retornou quatro commits e mudanças em22 arquivos de notificações/documentação/evidências/testes. Nenhum path coincide com as adições HDA E01 nem com os três arquivos do contexto local. Essa conferência é de metadados e paths, não regressão/avaliação completa da nova base. Preservar a onda de e-mails e reexecutar os gates no HEAD consolidado no Codex. Evidência: `25-final-upstream-recheck.json`.
