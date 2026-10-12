# HDW-00 — encaminhamento de saneamento ao custodiante

**Estado:** pendente de responsável autorizado. Documento preparado, não enviado a uma pessoa presumida. Não constitui notificação de incidente confirmada ou ordem de rotação.

## Achado

Arquivo físico: `patches/arquivos-sanitizados/novo-geo/gestao/auth.md`. Caminho lógico: `novo-geo/gestao/auth.md`.
Localizador: linhas **115–116**, contexto de configuração de chave criptográfica. O valor não consta neste documento, nos relatórios nem nos artefatos do incremento.

Source ID: `KBS-28e2e70340e0d1080d24cd8f`. SHA-256 do documento recebido: `32362cf576861133418203513413f04a5dc17d278a26743fd75c757096d661a4`. O hash identifica a versão do arquivo; não é hash isolado da credencial nem prova de origem.

O detector encontrou um literal no contexto AddEncryptionKey/FromBase64String. **Não foram testadas validade, utilização ou conexão a serviço.** A classificação é possível material sensível, não comprometimento comprovado. Esse arquivo e qualquer projeção dele ficam fora do lote editorial.

## Tratamento exigido

- [ ] Responsável pela manutenção/credenciais confirma o contexto do literal em canal apropriado, sem devolvê-lo ao agente ou incluí-lo no Git/relatório.
- [ ] Produzir uma versão saneada no repositório autoritativo da wiki, após revisão. Não apagar histórico para esconder o achado nem alterar os bytes do original usado como evidência local.
- [ ] Quando aplicável, decidir rotação/revogação, alcance em serviços e histórico/clones, com autorização, janela e responsáveis. Não fazer isso automaticamente para concluir a etapa de desenvolvimento.
- [ ] Registrar somente referência privada do tratamento, revisão/hash saneados, responsável e decisão. Não emitir uma aprovação fictícia, nome de pessoa ou prazo presumido.
- [ ] Incrementar a política, pinçar o novo hash e repetir a auditoria; revisar a lista de entrada e os indicadores remanescentes. Retirada da string não aprova publicação de texto técnico.

## Outros indicadores

Há padrões de URL no manual legado, exemplo de regex no documento de higiene, links fora da raiz e href executável documentado. O relatório preserva todos como indicadores/controlos de curadoria, **não como novas credenciais ativas confirmadas**. Endereços de contato encontrados também são motivos de revisão, não provas de incidente. A auditoria não tenta usar ou seguir esses valores.

## Conclusão que não foi emitida

Não há aceite do custodiante, rotação comprovada, source wiki substituída, validação de produção ou publicação editorial nesta entrega. A HDW-00 não está encerrada nesse critério externo.
