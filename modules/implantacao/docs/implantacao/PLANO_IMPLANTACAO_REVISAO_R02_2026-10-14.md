# Plano revisado — Implantação e Importações R02

14/10/2026. Complementa o plano original e a R01. Não considera implementado ou homologado o que permanece apenas candidato.

## Estado por incremento

| Incremento | Estado R02 | Próximo resultado verificável |
|---|---|---|
| IMP-00 Baseline/destinos | Parcial | Checkout integral, contrato de receptor aceito e exemplo com recibo real |
| IMP-01 Integridade | Parcial; núcleo/ponte e contratos avançaram | Página real, XLSX e integração dos registros canônicos ao fluxo existente |
| IMP-02a Processos/revisões/arquivos | Desenvolvido e testado focalmente; SQL candidato | Qualificar banco, autoridade e storage, montar no servidor existente |
| IMP-02 completo | Em desenvolvimento | Retomada multi-dispositivo, arquivos privados reais, políticas e proxy autorizado |
| IMP-03 Help Desk | Não iniciado | Vínculo idempotente, outbox/inbox, protocolo autoritativo e projeção |
| IMP-04 Cadastro/prévia | Não iniciado como incremento completo | Diff na importação sobre rascunho e confirmação da estrutura |
| IMP-05 Triagem | Não iniciado | Perfis distintos implantação/histórico/consolidado |
| IMP-06 Histórico | Parcial somente nas correções compartilhadas | Granularidade, corte, referências e extração da ponte para módulos diretos |
| IMP-07 OCR integrado | Não iniciado | Arquivos/revisões no processo e origem lado a lado |
| IMP-08 Vínculos | Núcleo R01 preservado, sem integração | Resolver entrega/amostra/CP sem dados fictícios |
| IMP-09 Aprovação/Dev Agent | Não iniciado neste pacote | Plano e versão exatos, autoridade e aprovação separada da técnica |
| IMP-10 Executor | Não iniciado | Um receptor qualificado e recibos reais |
| IMP-11 Conciliação | Não iniciado | Fonte × aprovado × execução × leitura do destino |
| IMP-12 Wiki | Não iniciado neste pacote | Publicar orientação após confirmar contratos e operação |
| IMP-13 Piloto | Não iniciado | Recuperação, ponta a ponta e aceite operacional |

## Próximo lote — IMP-02b e qualificação da integração

### 1. Checkout completo e R02 cumulativa

Confirmar HEAD e mudanças concorrentes. Aplicar o pacote R02 sozinho em base ainda sem R01; se R01 já entrou em outro branch, reconciliar manualmente a diferença com o Codex. Não reaplicar os dois pacotes nem modificar hashes de guarda. Executar os gates originais e novos. O bloqueio atual de clone não justifica liberar a aplicação por contagens focais.

### 2. Banco PostgreSQL 17 descartável

Ler `QUALIFICACAO_POSTGRESQL_R02.md`. Gerar a migration oficial com a CLI após revisão; não mover o candidato para migrations automaticamente. Qualificar bootstrap do papel restrito, RLS, privilégios, triggers, ciclo de head/revisão e COMMIT. Exercitar o adaptador com driver real, não somente snapshots de queries.

Testes essenciais: duas conexões salvando a mesma versão (um vencedor), timeout/queda antes e depois de COMMIT, replay recuperando recibo, mutação sem evento/recibo recusada, revisão imutável, tentativas cross-account e papel de banco inadequado. Completar fixtures/reprodutibilidade no CI do checkout completo.

### 3. Origem de autoridade real

Implementar adaptador para a fonte já definida pelo Help Desk/Setup. Não criar tabela paralela de permissões ou usar e-mail/CNPJ/nome como autorização. Confirmar acesso ao processo e obra existente; quando a obra ainda não existir, limitar à conta e à criação solicitada. Qualificar revogação, expiração, suporte atuando em nome do cliente e acesso a revisões antigas. Resolver a janela entre revalidação externa e commit segundo as capacidades da origem, sem alegar atomicidade distribuída inexistente.

### 4. Storage privado

Montar emissão de upload restrito e inspeção server-side. Chaves imutáveis, upsert desativado, vínculo ao processo, limites por arquivo/caso, sniff de MIME, limites de ZIP/PDF, scanner, checksum de bytes e versão do objeto. Definir comportamento para sessão expirada, objeto ausente, upload parcial e inspeção inconclusiva. Não marcar ready só porque foi enviada uma solicitação de upload. Implementar download autorizado separado e retenção/purge após decisão operacional; retainUntil sozinho não apaga dados.

### 5. Transporte e interface

Montar APIs no serviço existente, mantendo flags fechadas até testes. Criar adaptador Vue para salvar/retomar processo, mostrar confirmação do servidor e conflito de versão. Nunca apresentar sucesso por salvamento em localStorage. Ligar o wizard/conversor aos snapshots versionados sem serializar objetos de browser, credenciais ou buffers no JSON. Implementar paginação de arquivos/histórico antes de ampliar os limites desta fatia.

### 6. Jornada de aceite

Usuário A cria processo e adiciona planilha; fecha dispositivo; retoma em outra sessão/dispositivo com a mesma revisão. Usuário B sem acesso não vê processo/arquivo. Dois atendentes editam e o conflito é explícito. Arquivo adulterado/rejeitado não entra no snapshot; arquivo correto é retomado pela mesma chave/versionamento. A planilha é preparada com o mapeamento confirmado; alterar aba/unidade impede exportação obsoleta. Exportar ainda não significa importar no destino.

## Entrega por rodada

ZIP cumulativo e handoff, hashes da base e da fonte local, logs reais, testes não executados, status separado de desenvolvimento/qualificação/publicação/operação. Não abrir atendimento, executar agente com acesso amplo, enviar e-mail ou aplicar banco para contornar uma pendência.
