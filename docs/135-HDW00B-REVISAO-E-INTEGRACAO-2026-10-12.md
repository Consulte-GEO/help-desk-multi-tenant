# Revisão e integração HDW-00/00b — 12/10/2026

## Situação encontrada e cobertura

Base local e principal remota `codex/m1-reproducibilidade`: `d38cfad95eb8e0e92ec626ae5a1506cbb33ddb2c`, confirmadas em 12/10. Checkout limpo. R1/PR26 já consolida os 18 ciclos; publicação e matriz operacional em [134](134-CONSOLIDACAO-R1-2026-10-11.md). Nenhum cumulativo antigo foi reaplicado. API/interface 0.27.0, schema 0.19.0, 12 migrations históricas e 19 operações HTTP. Atendimento fechado.

O pacote HDW estava somente nos arquivos entregues. Seus 28 arquivos foram conferidos pelos hashes do manifesto; patch aditivo verificado e aplicado no checkout integral, branch `codex/hdw00b-revisao-20261012`. Relatórios e handoff são referências. A autorização para corrigir, integrar e publicar sem Claude veio diretamente do usuário.

Revisão detalhada das CLIs, leitor JSON, inventário, indicadores, links, seletores, plano, tipos e testes; conferidos fingerprint, staging CI, build e vínculo com o store/publicador existente. Revisor independente somente leitura reproduziu problemas. O conjunto histórico é revalidado pelos gates integrais, incluindo banco/upgrade e browser. Isso cobre regressões dos 18 ciclos; não constitui auditoria manual linha a linha de todos os stores/adapters nem aceite hosted.

## Correções e melhorias

| Problema demonstrado | Correção e comprovação |
|---|---|
| `realpath` recusava caminhos Windows válidos quando apenas a caixa mudava | Comparação ASCII específica de Windows, mantendo identidade/metadados, `lstat`, `nlink` e rejeição de links. Regressões de raiz/drive e JSON RED→GREEN. |
| Folding Unicode equiparava diretórios distintos `k` e `K` | Comparação restrita a ASCII, regressão RED→GREEN. Não certifica configurações especiais de case sensitivity do NTFS. |
| Política editorial e decisões entregues não alteravam o fingerprint canônico | `docs/knowledge` incluído no hash e staging CI. Regressão da criação/alteração da política e plano RED→GREEN. |
| Regex Markdown tinham custo quadrático antes de `link_limit` | Linha acima de 4.096 caracteres recusada antes das regex. Probe independente: 128.000 `[` levou 210.866 ms antes e 1 ms após. Regressões do parser/auditor comprovam bloqueio e ausência de candidatos. |
| Quota por fonte permitia multiplicar metadados por centenas de documentos | Quota global de 10.000 links; excedê-la recusa auditoria integral com erro seguro e sem resultado parcial. Regressão com duas fontes de 6.000 links RED→GREEN. |
| README misturava versões e resultados superados | Estado atual reescrito, anterior preservado em `docs/history/r1-README.md`; checkpoints apontam para esta revisão. |

Adicionados atalhos `knowledge:audit` e `knowledge:review`. Package-lock/dependências preservados. Nenhum endpoint, SQL, grant, scope, Auth ou gate operacional ampliado. Assets opcionais continuam candidatos; cópia no build não comprova montagem no runtime.

## Fonte real e revisão editorial

ZIP `wiki-docs-v3.zip`, SHA-256 `55554f70d7058a74cebac627b654bd7ec0b3112c4dd2dfc853238f44f62b1d9e`. Extração privada fora do repositório com limites de caminhos/tamanhos. Nenhum comando do wiki executado ou literal sensível autenticado/testado/reproduzido.

Após correções: 41/41 fontes pelos hashes originais, 300 localizadores, 452 links, 121 referências relativas ausentes e cinco fontes em quarentena. Maior linha: 2.828 caracteres, abaixo do limite novo. Plano preparado idêntico ao entregue, inclusive binding; 41 ações de fonte e 300 de item `pending`, zero seleções. Auditoria exit2/blocked, prepare exit0, check exit2/review_incomplete. [Recibo](../evidence/hdw00b/corpus-receipt.json). Fonte/corpos/saídas privadas não integram `dist`.

O publicador existente exige assurance, capability e revisão própria ligada ao hash. A CLI não é consumida automaticamente pelo runtime. Sugestões JSON não provam autoria, saneamento, aplicabilidade ao Novo GEO ou autoridade de publicação.

## Validação

Sete regressões tiveram RED observado e GREEN, zero skips/cancelamentos. Typecheck usa TypeScript/tipos Node reais fixados no lock. Gates de lock, 12 migrations, contratos, scanner heurístico e build executados; audit retornou zero vulnerabilidades.

Baseline Windows/sandbox: 3.574 testes, 3.458 aprovados e 116 falhas, sem skips. Incluem links/Unix sockets recusados, OpenSSL ausente, transporte local e timeouts. Candidato original fora do sandbox: 147/155 aprovados, seis EPERM de symlinks e dois timeouts, antes das correções. Não foram considerados homologação. [Resumo](../evidence/hdw00b/windows-summary.json) e [todas as falhas por nome](../evidence/hdw00b/windows-baseline-failures.txt).

O fingerprint R1 ficou incompatível deliberadamente. Nova homologação integral Linux Node22/PostgreSQL17/Chromium exigida, com instalação limpa, audit, aplicação, banco e interface da mesma execução. Nenhum relatório editado para fabricar aprovação. CI, merge e publicação serão registrados após verificação.

## Pendências preservadas

HDW-00 requer tratamento/decisão do custodiante e revisão da allowlist/editorial. Quarentenas são indicadores, não cinco credenciais ativas comprovadas. Não selecionar os 300 itens automaticamente.

HDW-01 requer API/IdP qualificados do Novo GEO, commit/schema, identidade, revisão de acesso, mapeamentos e leituras autorizadas. [Roteiro](integrations/HDW01-QUALIFICACAO-DOCUMENTAL-NOVO-GEO.md). Sem fonte não criar endpoints/adapters fictícios.

M1 operacional permanece aberto: jornada humana/M2M e atendimento reais, cadastros/contratos, montagem conjunta, custódia/SMTP/recuperação quando aplicáveis, capacidade/SLO, restore e aceite humano. A publicação técnica não encerra esses critérios nem abre `HELPDESK_RELEASE_APPROVED`.

## Homologação canônica aprovada

[CI38233948714/1](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38233948714): **3.736/3.736 aplicação, 294/294 PostgreSQL e 139/139 interface**, sem falhas, skips, cancelamentos ou TODO. Instalação limpa, audit, typecheck, contratos, migrations, scanner e build aprovados. O CI de push38233940026 também passou. CodeQL aprovado.

Head92fac584f5b4e3435e5750ab5313b48df4688009; fonte testada pelo evento PR9ce945e694a1ff286ff83139c65e301c6fb1912c. Fingerprint4c4ca8098607eb24da5f6b7dde6cebb912ee591438bdaed17889b6cec97cb678, igual ao checkout atual. ZIP oficial555728bytes, artefato11740027138, SHA256befa70a2510bf875dd11d640db674ff9cbdd4ac4a96ed57de11d41f56b1ce5eb, calculado e conferido antes da extração.

Relatório e seis logs originais da execução4fe12687-97a8-4c4f-bb14-ce62a2d8842e importados sem edição. source.json preserva o commit/run da origem. `npm run check:homologation` aprovou o vínculo e os hashes no checkout atual. [Recibo](../evidence/hdw00b/ci-receipt.json). Relatórios HTTP/browser copiados literalmente; screenshots desktop/mobile inspecionadas, sem nova regressão visual observada nas telas exercitadas. Fixtures sintéticas não equivalem a jornada humana real.

Reinspeção Supabase antes da publicação: projeto HelpDesk ACTIVE_HEALTHY, PostgreSQL17, 12 migrations existentes e 25 tabelas privadas com RLS habilitado. Não houve leitura de dados de pessoas, alteração de Auth/scopes ou SQL remoto. Isso não comprova FORCE RLS nem todos os grants de produção; não ampliar a conclusão além da consulta realizada.
