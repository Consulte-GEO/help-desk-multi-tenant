# Handoff Codex — Implantação e Importações / R01

## Missão

Integrar e qualificar o código R01 do Setup. Não interpretar este pacote como sistema completo nem liberar o atendimento/importação operacional. A solicitação atual autoriza desenvolvimento; publicação/merge obedecem à autorização vigente do mantenedor para a entrega.

## Leia antes

`CLAUDE.md`/instruções atuais do repositório, plano original de 14/10/2026, `docs/implantacao/PLANO_EXECUCAO_R01_2026-10-14.md`, especificação R01, baseline/capacidades e `IMPLEMENTATION-REPORT-V16-IMP01.md`.

Repositório de destino: `Consulte-GEO/setup-implantacao-obras`. Base inspecionada: `dcf5607652281bb688f366e6a4f05e07eb698d31` em `main`.

## Aplicar o pacote

Descompacte **fora do checkout**. O ZIP não é overlay para copiar cegamente. O aplicador precisa continuar fora da raiz para o teste de checkout limpo não acusar o próprio pacote. Preserve seu arquivo de integridade e MANIFEST.

```sh
# No checkout integral autorizado; não reutilize o snapshot parcial da sessão GPT.
git status --short
git fetch origin main
git switch -c claude/v16-imp01-integridade origin/main

# Ajuste os dois caminhos locais. Por padrão a ferramenta não escreve.
node /caminho/ao/pacote/aplicar-r01.cjs --repo /caminho/ao/setup-implantacao-obras --check
node /caminho/ao/pacote/aplicar-r01.cjs --repo /caminho/ao/setup-implantacao-obras --apply

git diff --check
git diff --stat
```

A ferramenta exige raiz do repo, branch isolada, checkout limpo, descendência da base e blobs esperados. Verifica tudo antes de escrever; recusa mudanças concorrentes, colisões, payload adulterado e links simbólicos. Normaliza CRLF apenas para a comparação de origem e preserva o estilo de arquivos existentes ao escrever. É aplicação de arquivos local, não transação global nem migrador de banco. Não operar simultaneamente no mesmo checkout.

Se o HEAD ou qualquer arquivo tiver evoluído, a recusa é deliberada: compare as alterações e produza uma nova integração revisada. **Não alterar o hash esperado para forçar aprovação.** Não sobrescrever `main`, não usar o ZIP como dist Netlify e não importar os arquivos de `baseline-leitura` como código novo.

Mudanças transformadas sob guarda: carregamento/montagem no `frontend/public/importa.html`, metadados `package.json`/`package-lock.json`, headers de cache em `netlify.toml`. O código do HTML integral não estava disponível no container original; o aplicador valida sua sintaxe inline no checkout completo antes de escrever.

Metadados candidatos: frontend **5.0.22-52**, Copilot **3.5.0**, SimilarityEngine **2.0.0**, geomat schema **1.2.0**. O lock anterior tinha versão raiz 5.0.22-45, diferente do package 5.0.22-51; sincronizar apenas metadados, sem regenerar resoluções arbitrariamente.

## Executar gates reais

```sh
cd frontend
npm ci --ignore-scripts
npm run typecheck
npm run build
npm run smoke
npm run smoke:contrast
npm run smoke:xlsx
npm run test:laudos
npm run test:laudo-vision
npm run test:import-integrity
npm audit --omit=dev
cd ..
node tools/run-intake-tests.js
node tools/run-similarity-tests.js
node tools/run-implantacao-import-tests.js
```

Executar ainda as verificações adicionais definidas no repositório atualizado. Não enfraquecer os gates. O teste Edge pode anunciar SKIP sem Deno: nesse caso o resultado é **não executado**, mesmo com exit 0. Os novos testes TypeScript usam o pacote instalado no frontend no checkout integral; o teste da sessão GPT usou TypeScript global 5.8.3 e não prova a reprodução pelo lock.

Ensaio adicional opcional e estritamente focal:

```sh
python tools/run-import-integrity-browser.py --output /caminho/externo/evidence/browser-r01
```

Requer Playwright/Chromium. O runner usa conteúdo em memória, sem rede. Colaboradores são sintéticos: não substitui a página real ou a geração do XLSX.

## Jornada obrigatória na aplicação real

Uma linha com `Slump 120 mm` deve virar 12 cm; `120` sem unidade deve ficar pendente até confirmação. Cabeçalho `Slump previsto`/faixa `12±2` não deve preencher o medido. Testar escolha de unidade, mudança de mapeamento/aba/arquivo e limpeza das decisões antigas.

Confirmar que valores ausentes não recebem volume padrão; placa IMPORT segue como marcador operacional. A ação de aceitar referências nominais deve ficar desabilitada e a guarda de código deve negar caminhos antigos/ações em lote.

Duas entregas com data/local iguais não podem ser fundidas silenciosamente. Confirmar o mesmo número apenas quando forem do mesmo evento; usar números diferentes para eventos diferentes. Depois de editar data/local/peça, a confirmação precisa ser refeita.

Exportar com/sem pendências, reabrir o arquivo e conferir tipos/linhas/proveniência. Não declarar “dados importados” pelo simples download. Testar rejeição, edição repetida e revalidação sem acumular achados.

No cadastro, verificar tipos de peças distintas, volumes, projetistas e nomes. Validar o consumidor do JSON geomat 1.2.0; FLOW não deve virar slump. A descrição original deve permanecer. Compatibilidade externa não foi homologada.

## Regressões conhecidas de política

S11 e S15 da SimilaritySelfTest foram fortalecidos para atender ao plano aprovado (nominal não é medição; unidade não é inferida). Os 21 IDs foram preservados. Não restaurar as expectativas antigas apenas para satisfazer uma contagem histórica. A revisão não retirou smoke geral ou controles de segurança.

## Não fazer nesta rodada

Não alterar banco, migrations históricas, RLS/Auth, secrets/MFA, Edge Functions ou flags do Help Desk. Não criar rascunhos/pedidos produtivos, executar Claude CLI com acesso irrestrito, enviar notificações ou chamar IA paga. Não reescrever Vue/Vuex nem remover skeleton .NET. Não abrir o gate do Help Desk para compensar a origem M08 ainda não qualificada.

## Entrega de continuidade

Gerar novo relatório com branch/commit verdadeiros, testes do checkout completo, falhas herdadas/regressões, limites e estado de publicação. Caso precise corrigir a integração ou o receptor, manter TDD e atualizar ZIP cumulativo, plano e handoff. Só afirmar operacional após execução/recibos/conciliação e aceite próprios.

A próxima fase funcional é IMP-02, mas o fechamento dos checks de IMP-00/01 acima vem antes da automação real.
