# Revalidação independente — Consulte GEO M04

Data: 13/10/2026. HEAD `d7ecc6a`. Revalidação dos achados de `223cba4` e revisão do delta corretivo, dos novos cenários SQL, fixture de navegador e registro na suíte. Somente leitura da implementação; a única escrita é este relatório.

## Resultado

**Revisão de código/local aprovada: nenhum Critical ou Important restante identificado.** Os dois achados da primeira revisão foram corrigidos. A integração depende ainda da aprovação do CI integral do HEAD final, especialmente dos cenários PG17; não considero o CI em andamento aprovado.

## Revalidação dos achados

### P1 — admissão SQL de textos incompatíveis com o leitor: corrigido

`supabase/candidates/hdn_consultegeo_configuration.sql` agora separa `hdn_cfg_text`, `hdn_cfg_singleline`, `hdn_cfg_checklist_text` e `hdn_cfg_string`.

- As funções contam unidades UTF-16, incluindo dois para caracteres fora do BMP, e tratam os caracteres de whitespace do trim ECMAScript explicitamente.
- Título raiz/reason e os campos privados de capability usam singleline, recusando C0/C1. Textos de formulário preservam CR/LF/TAB e C1 admitidos pelo contrato compartilhado. Labels de checklist recusam os controles adicionais proibidos pelo parser M02.
- `when.equals` textual tem o limite 32768 em unidades UTF-16 imposto pelo copier JavaScript.
- As novas funções permanecem privadas pelo mesmo REVOKE sobre `hdn_cfg_%`; não surgiu endpoint ou grant de DML adicional.

Os novos cenários nativos usam comandos raw SQL com intent hash correto para LF em título/reason, 101 emojis no título, título somente NBSP, controle U+0001 no checklist e condição textual excessiva. Exigem `HDC04` e contagens inalteradas. No cenário agregado, uma aceitação indevida lança um erro próprio com código diferente: o teste não pode ficar verde por rollback provocado pelo próprio teste. O cenário positivo publica 100 emojis no título, 80 na label de formulário, 150 no checklist e orientação multiline com C1 permitido, comparando os artefatos JS e PostgreSQL.

Conclusão de revisão: a correção cobre as reproduções e preserva textos válidos. **Execução nativa GREEN desses cenários ainda depende do CI `d7ecc6a`, não executado nesta revisão.**

### P2 — evento tardio repõe dados depois de clearAudience: corrigido

`web/consultegeo-configuration.js` descarta `current`, `original`, `options` e intent, remove opções do select e mantém phase cleared. `drawEntry` e wrappers de eventos não escrevem depois da limpeza; os catches também verificam phase antes de escrever mensagens. O guard por epoch do envio continua impedindo respostas tardias de alterar o estado.

A regressão adicionada dispara select/change e todos os botões após limpeza, depois dispara change no elemento antigo após destroy. Passou nesta revalidação. Executei ainda um probe independente com envio pendente: confirmed, rejected e unknown entregues depois de clearAudience mantêm phase cleared, textarea vazia, preview antigo ausente e somente um submit. Destroy mantém root vazio.

## Fixture e navegador

- `tests/fixtures/configuration/browser-server.ts` exige opt-in `synthetic-loopback`, escuta somente em `127.0.0.1` com porta própria e valida Host/origin. Serve somente os assets conhecidos. Usa handler, publisher e compilador reais; Auth, capabilities e persistência são os fixtures sintéticos declarados. Não contém fallback do runtime ou instalação remota.
- `tests/browser-consultegeo-configuration.py` cria/encerra o seu próprio processo e navegador. Verifica desktop 1440 e mobile 390, cinco ações, preparação sem write, confirmação, metadados/imutabilidade, restore, limpeza com evento tardio e conciliação de resposta desconhecida sem novo audit; exige zero pageerrors.
- O cenário está em `scripts/test-ui-local.mjs` com `ownsFixture:true`, evitando anexar/reutilizar um servidor externo. O teste de build inclui os novos assets e confere cópia byte a byte e ausência dos diretórios privados.
- Inspecionei os screenshots locais 1440/390. O layout de duas colunas se torna uma coluna, os conteúdos permanecem legíveis e o limite sintético está explícito.
- O implementador informou 16 checks Chromium aprovados. Eu li a suite/fixture e inspecionei screenshots, mas não executei novamente Chromium nesta revisão; não transformo essa evidência em aceite hosted, Auth real ou SQL real.

## Evidências executadas nesta revisão

`node --experimental-strip-types --test --test-reporter=tap tests/consultegeo-configuration.test.ts tests/consultegeo-configuration-publisher.test.ts tests/consultegeo-configuration-store.test.ts tests/consultegeo-configuration-http.test.ts tests/consultegeo-configuration-editor.test.ts tests/forms-build.test.ts`

Resultado: **43/43 aprovados**, exit 0, zero falhas/skips. São 42 M04 mais a whitelist de build. Não repeti a suíte histórica integral.

Probe independente de resposta assíncrona depois da limpeza: três casos (confirmed/rejected/unknown) aprovados. Inspeção de Git confirmou o delta revisado entre `223cba4` e `d7ecc6a`; implementação não alterada pelo reviewer.

## Fora do veredito

- CI integral/PG17 final: em andamento no despacho; nenhuma consulta de rede ou execução nativa nesta revisão. RED informado de `41fa873` é evidência do implementador, não aprovação de `d7ecc6a`.
- Migration/upgrade em produção (M05), montagem operacional de HTTP/editor (M06), handlers de origem (M08), Storage/scan (M11) e clocks/SLA de tickets: continuam fora do recorte M04, conforme spec.
- Hosted, e-mail, merge/deploy e mudanças de gate/segredos: não executados e não aprovados por esta revisão somente de leitura.

## Veredito final

**Pronto para integrar após CI integral aprovado no HEAD final.** Os achados de admissão e cleanup estão resolvidos na implementação e nas evidências locais examinadas. Não identifico outra correção de código obrigatória no delta revisado; falta a confirmação PG17/integração total que já está em curso.
