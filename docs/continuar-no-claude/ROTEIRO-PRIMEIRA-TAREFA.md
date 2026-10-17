# Primeira contribuição pelo Claude

Comece por uma alteração pequena de documentação ou apresentação já autorizada pelo responsável. O objetivo é exercitar acesso, leitura da revisão correta, branch, feedback de teste e revisão humana antes de um recorte de persistência ou integração.

## Contrato da tarefa

Preencha a ficha na issue ou descrição do PR:

- ID e resultado visível esperado.
- Comportamento já existente e fonte/commit lidos.
- Usuários e contexto afetados; arquivos previstos.
- Saldo específico, dependências e decisões de negócio já resolvidas.
- Como reproduzir, resultado antes/depois e teste pertinente.
- Etapas do mantenedor quando houver arquivo protegido ou configuração externa.

Campos ainda desconhecidos permanecem pendentes; não completar com políticas, dados de cliente ou endpoints inventados.

## Fluxo pelo MCP

1. Conferir sessão/grants e contexto. Ler arquivos na mesma revisão.
2. Ler a issue com `ver_issue` se a versão conectada oferecer a consulta. Verificar comentários/pareceres e os SHAs a que se referem.
3. Criar branch pessoal; o servidor gera seu namespace. Ler seu HEAD antes de editar.
4. Validar o lote e salvar com `expected_head`. Usar uma chave por intenção e manter a mesma chave/payload se consultar a repetição dessa intenção.
5. Abrir PR draft. Salvar um commit em `mcp/**` não comprova que a suíte iniciou: conferir o evento real do PR.
6. Consultar CI do SHA exato. Quando houver check ID, consultar sua saída textual por `ver_diagnostico_ci`. Se estiver vazia/truncada ou faltarem logs, acionar o mantenedor pelo fluxo aprovado.
7. Receber revisão, corrigir conscientemente e requalificar o novo SHA. Merge/publicação são etapas do mantenedor.

## Fluxo pelo Claude Code

Reproduzir a base conforme AMBIENTE; editar o recorte em branch própria; executar os checks que verificam os riscos alterados e os gates exigidos pelo projeto. Abrir PR com fonte, comportamento, validação e limites. Corrigir feedback sem reutilizar o recibo de outra fonte como teste do novo commit.

## Condição de conclusão

A pessoa consegue retomar a tarefa sem esta conversa, identificar falha ou ausência de diagnóstico, corrigir o recorte e entregar uma revisão verificável. O relatório distingue código, testes realmente executados, revisão, merge, deploy e aceite. Uma ferramenta aparecer no catálogo não fecha o piloto.
