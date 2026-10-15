# Autorrevisão E04

Escopo: sete módulos novos do processador de análise, fixture e três suítes. Não houve revisor independente, execução de SQL, CLI real ou alteração hospedada.

## Achados reproduzidos e corrigidos

| Achado | Reprodução | Correção e prova |
|---|---|---|
| Flag desativada após escrita preparada podia confirmar rascunho | `11-red-review-findings.tap`: esperado reconciliation_required, recebido draft_ready | admissão transmitida ao dono da transação; `12-green-review-findings.tap` e suíte final |
| Falha no diretório de trabalho vazava path privado | mesmo log vermelho contém ENOENT com diretório sintético | envelope de erro tipado e sem causa/path; teste verde |
| Diagnóstico copiava operationId antes de recusar receipt de outra conta | `19-red-diagnostic-boundaries-unprivileged.tap` | contexto/hash primeiro; campo permanece null no retorno recusado |
| Confirmação desconhecida sem finalidade do recibo | mesmo log vermelho | `settlementPermission` complete/fail retornado quando conhecido; nenhum conteúdo do modelo retido no diagnóstico |

Os números de arquivos de log são históricos desta execução. `18-red-diagnostic-boundaries.tap` teve, além dos negativos em desenvolvimento, uma recusa esperada do supervisor porque foi executado como root. O teste foi repetido como usuário não-root antes de corrigir o produto; `19` contém somente os três negativos pretendidos. Nenhum skip ou remoção de guarda foi usado.

## Verificações adicionais

JSON bruto: membros duplicados, inclusive escapados e aninhados; UTF-8 inválido; limites; metadados numéricos sem autoridade. Contexto: campos de alvo não copiados automaticamente para stdin; texto com instruções permanece dado. Wiki: hash exato, zero leitura de URL/arquivo. Processos: sem shell, sem herança de ambiente, home próprio, versão/hash, cancelamento, timeout e erro privado. Worker: reserva confirmada, modelo fora de transação, revalidação, repetição sem relançamento, ausência de comando compensatório após incerteza e rascunho não executável.

## Limites que não foram convertidos em promessas

- O supervisor não é um sandbox; confinamento de rede/arquivo e filhos que escapem de grupo continuam dependência do host.
- Não foi testado o verdadeiro Claude ou o suporte real das flags. O executável de teste é uma fixture Node offline.
- Hash da wiki comprova igualdade do texto, não aprovação editorial; o publicador ainda precisa ser composto.
- A persistência em memória não prova RLS, locks ou COMMIT PostgreSQL. A admissão real deve ser composta com runTransaction.
- Não há monitoramento contínuo de revogação nesta biblioteca; há checagens nas fronteiras e cancelamento explícito.
- Não houve npm ci/audit/build completos. A checagem final de tipos usa @types/node22.19.7, não a versão do lock.
- Não foi feita integração de HTTP, abertura, cron, revisão humana ou escrita de cadastro.
