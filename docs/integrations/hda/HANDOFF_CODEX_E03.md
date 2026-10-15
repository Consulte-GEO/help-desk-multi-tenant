# Handoff CODEX — E03 cumulativa

## Objetivo imediato

Integrar a revisão E03, fechar a prova nativa da HDA-02 e **não habilitar o Claude ou escrita no Novo GEO**. Leia AGENTS.md, PROJECT_HELP_DESK.md, os checkpoints atuais, o plano V2 e EXECUCAO_E03.md.

Principal observada: `d5610aca8b4a5ca65567c0c92b2c7a1df5aa6da4` (PR41). Reinspecione antes de aplicar; preserve os desenvolvimentos concorrentes. Este pacote é um overlay, não um checkout completo.

## Aplicação dos arquivos

Sem HDA anterior integrado: conferir e aplicar `patches/HDA_E01_E02_E03_CUMULATIVO.patch`.
Com E02 idêntica integrada: conferir e aplicar `patches/HDA_E03_DELTA_SOBRE_E02.patch`.
Com modificações concorrentes: reconciliar por arquivo, sem force/reset ou sobrescrita ampla. Não aplicar ambos os patches.

```sh
git status --short
git apply --check /caminho/pacote/patches/HDA_E03_DELTA_SOBRE_E02.patch
git apply /caminho/pacote/patches/HDA_E03_DELTA_SOBRE_E02.patch
```

`repo/` contém os arquivos HDA cumulativos. `verificacao/context/` serve somente para reproduzir testes limitados e **não deve substituir package.json, tsconfig.json, canonical.ts, errors.ts ou sql.ts do projeto**. Não há dependências vendorizadas no ZIP.

## Gates da árvore real

```sh
npm ci --ignore-scripts
npm run check:lock
npm test
npm run typecheck
npm run check:contracts
npm run check:migrations
npm run check:consultegeo-upgrade
npm run check:secrets
npm run build
npm audit --audit-level=high
python scripts/verify-hda-canonical-vectors.py
```

Produzir evidência nova da mesma fonte, com os scripts de homologação do repositório. O relatório de CI da principal ou os logs deste subconjunto não homologam a árvore após integração.

## Prova nativa obrigatória

Executar como usuário Linux não-root, com PostgreSQL 17 disponível, `pg` 8.16.3 instalado pelo lock do projeto e sem URLs/variáveis externas de banco herdadas:

```sh
node scripts/test-registration-db-native.mjs --plan
# HDA_PG_BINDIR, quando necessário, aponta apenas para binários LOCAIS instalados.
node --experimental-strip-types scripts/test-registration-db-native.mjs --execute
```

Não remover guardas para fazer o script passar. O runner cria um cluster novo por socket Unix, sem listener TCP. Não se conecta ao Supabase nem recebe DSN. Examinar o campo `cleanup`; se preservado, diagnosticar o diretório indicado e confirmar que o cluster próprio parou antes de qualquer remoção.

A suíte deste runner instala um **core sintético mínimo**. Sua aprovação ainda não fecha a integração com as migrations históricas, owners, defaults, privilégios e catálogo de prontidão reais. Fazer essa segunda qualificação em outro cluster descartável, pelos mecanismos atuais do projeto. Não transformar a fixture ou suas contas em seed de produção.

O SQL E03 adiciona `queue_hash`, verificações de escopos do core e trigger diferida da tarefa. Ele é uma revisão do **candidato local não instalado**. Não aplicar como patch DDL num banco que já recebeu E02. Após qualificar, gerar migration nova via CLI, manter o histórico e atualizar manifest/inventário/readiness conjuntamente. Nada de trocar apenas o marker ou editar migration antiga.

## Revisão funcional exigida

Confirmar que ausência/revogação de `tickets:read` impede leitura e replay; ausência de `tickets:write` impede mutações humanas, mas permite leitura autorizada. O worker não recebe `tickets:write` só para devolver uma análise. Confirmar que NULL nunca concede autorização, a nova revisão de scopes disputa o mesmo advisory lock, a tarefa não diverge do seu hash e uma reserva expirada antes do COMMIT é recusada.

Os ACKs já são testados nas duas fronteiras TypeScript. Não converter a recusa local em uma nova chave automática. Uma confirmação desconhecida exige conciliação; replay de claim não fornece outra reserva.

## Continuidade depois da prova

Fechar HDA-02 (incluindo publicador de binding qualificado, política, cotas/retencão e schema de promoção). Na HDA-03 usar a transação original da abertura para gravar chamado + intenção + tarefa, mantendo protocolo, recibo e outbox de email originais. Não abrir transação paralela, chamar modelo dentro de lock ou usar a família “Cadastros e acessos” para habilitar todos os tipos.

Retornar diff/fonte, resultados reais de cada camada, pendências, ZIP cumulativo e handoff. Esta entrega não autoriza mudanças de produção.
