# Handoff Codex — integrar E01 e continuar HDA-02

**Produto:** Help Desk Consulte GEO. **Épico:** HD-DA-CADASTROS. **Origem do plano:** V2.0. **Base GitHub inspecionada:** `511523bea50c053a3bf1ac027be7a4ff01414930`. **Entrega:** arquivos aditivos, sem migration ou runtime ativo.

## Primeiro leia

`EXECUCAO_E01.md`, `PLANO_ATUALIZADO_E01.md`, `HDA01-contracts-and-canonicalization.md`, `MATRIZ_EXECUCAO_E01.json` e o plano V2 original incluído no pacote. Leia também AGENTS/PROJECT/relatórios atuais do checkout completo antes de integrar. O estado antigo V2 de atendimento fechado já foi superado na fonte inspecionada; não reverter funcionamento atual.

## Aplicação segura

1. Atualizar a leitura de HEAD e branches no repositório real; verificar se outros desenvolvimentos já adicionaram os mesmos arquivos ou interfaces. Trabalhar em branch/worktree isolado, preservando mudanças concorrentes.
2. Este ZIP NÃO é um clone completo. `repo/` contém somente adições propostas. `verificacao/context/` contém três arquivos de referência e um package.json efêmero para reproduzir o ensaio; **não copiar esse contexto para o repositório real**.
3. Preferir revisar/aplicar `patches/HDA_E01.patch`, depois de `git apply --check <caminho>/patches/HDA_E01.patch`. O patch é aditivo; foi produzido em histórico local de subconjunto e não deve ser usado como substituto de branch remota. Alternativamente integrar só os paths listados em `ARQUIVOS_NOVOS.txt`, após confirmar ausência de colisão.
4. Não substituir package.json, lockfile, tsconfig, core canonical/errors, runtime, web/app, AGENTS, PROJECT ou migrations pelo material de reprodução. Não copiar fixtures/evidências para bundle público.
5. Se o código equivalente já existir, comparar a implementação e preservar a mais recente; não sobrescrever por nome. Resolver conflitos contra as decisões e testes, sem remover proteções.

## Verificação no checkout completo

Usar Node compatível com o package atual e `npm ci` com lock canônico. Executar os comandos existentes do projeto, não o package efêmero:

```sh
npm test
npm run typecheck
npm run check:contracts
npm run check:migrations
npm run check:consultegeo-upgrade
npm run check:secrets
npm run build
python scripts/verify-hda-canonical-vectors.py
```

Em ambiente apto executar também as suítes PostgreSQL/interface e o workflow oficial/source-bound definidos pelo repositório, incluindo `npm run check:homologation` e `npm run verify:release` quando a evidência nova estiver presente. Conferir scripts atuais antes de invocá-los. Falha de infraestrutura ou evidência antiga NÃO é aprovação. Nenhuma contagem desta E01 substitui a CI da base consolidada.

Os122 testes locais cobrem o incremento apenas. Os26 vetores Python validam a mesma fixture independentemente; a versão .NET do executor ainda precisa rodá-la. Os81 casos V2 permanecem requisitos mais amplos, não um total passado.

## Invariantes a preservar

- Os helpers E01 são puros/candidatos e não autorizam a origem. Nenhuma flag, JSON `approved`, UUID ou hash fornecido pelo cliente prova permissão.
- Não montar os helpers diretamente como HTTP/worker sem autenticação, ACL, transação e persistência real.
- A máquina só tem estados de análise; nada marca cadastro concluído ou resolve chamado.
- `ExecutionApproval` e `OriginObservation` são types, não serviços de aprovação/execução/recibo autenticado.
- `previewRef` do rascunho E01 é null. A evolução para prévia/execução exige versão e política explícitas.
- O primeiro piloto só adiciona vínculo e preserva os anteriores, sem mudar perfil ou enviar convite.
- Não utilizar decoder canônico restrito no envelope CLI inteiro: metadados decimais do fornecedor exigem decoder limitado separado.
- Não usar lastEvent como inbox: persistência/dedupe/leases reais pertencem a HDA-02.
- Não criar segunda fila/canal Resend; HDA-10 precisa integrar o mecanismo atual.

## Próxima tarefa

Executar HDA-02 conforme `PLANO_ATUALIZADO_E01.md`, no checkout completo e PostgreSQL17 descartável. Avançar HDA-00 na origem/host reais em paralelo. Sem esses contratos, implementar apenas adaptadores de teste declarados como tais, nunca fallback de produção.

## Publicação e retorno

Esta entrega não executou push/PR/merge/deploy, SQL remoto ou cadastro. A integração de código precisa da revisão e da CI atuais; ativação funcional exige autorização e seus gates próprios. Atualizar a matriz de status ao final distinguindo local,PG17,browser,origem,publicado,homologado e operacional.

Se a integração deste incremento aditivo precisar ser revertida antes de qualquer consumidor ser criado, reverter somente seus arquivos/commit após verificar dependências. Não reverter core0.31, schema0.24, worker de e-mails ou outras frentes. Uma reversão do código E01 não desfaz efeitos de futuros executores.

Entregar novo ZIP cumulativo com handoff, diff/manifest e evidências da fonte exata. Revisão E01 foi autorrevisão; solicitar revisão independente no ambiente que disponha desse recurso antes de liberar capacidades de escrita.

## Reinspeção final de concorrência

Antes do empacotamento foi observado o novo HEAD `875df195745c950590d851f91eb609e7b98a1119`, merge PR38 (Email Kit, primeira onda). O compare contra `511523bea50c053a3bf1ac027be7a4ff01414930` retornou quatro commits e mudanças em22 arquivos de notificações/documentação/evidências/testes. Nenhum path coincide com as adições HDA E01 nem com os três arquivos do contexto local. Essa conferência é de metadados e paths, não regressão/avaliação completa da nova base. Preservar a onda de e-mails e reexecutar os gates no HEAD consolidado no Codex. Evidência: `25-final-upstream-recheck.json`.
