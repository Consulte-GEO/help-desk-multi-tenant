# Ciclo 02 — identidade externa reconhecida sem conceder acesso

**Situação:** parte independente implementada e testada localmente. C01 e a conclusão integral de C02 permanecem pendentes. Nenhuma alteração de runtime, rota, schema, migration ou configuração hospedada nesta entrega.

## Avanço

O domínio separa referência externa, credencial Supabase, credencial externa e registro de pessoa. O resolvedor aplica a sequência `verificador de identidade → diretório exato → validação final de vigência → recibo de correspondência`. Ele não cria pessoas ou credenciais, não atribui roles/grants, não emite sessões e não consulta obras. `ExternalIdentityMatch` não é Principal, `VerifiedGeoIdentity` criptográfica nem prova portátil de autorização.

A porta verificadora é obrigatória e configurada no servidor. Um manifesto candidato, JWT decodificado ou `verified:true` não substitui essa porta. Verificador e diretório reais ainda não foram implementados. Os testes exercem os módulos reais com adaptadores sintéticos; não há fallback sintético distribuído no código de produção.

O diretório precisa devolver exatamente o par solicitado e principalKind humano. Registro ausente, revogado, inativo ou ambíguo é recusado, nunca preenchido por e-mail. Retorno de origem Supabase em lookup externo é incompatível. O caminho Supabase existente não foi alterado, mas sua regressão completa não foi executada nesta rodada.

## Tempo, concorrência e falhas

Instantes reutilizam shared/instant.js com microssegundos exatos. A identidade é conferida após verificar a origem e depois de esperar o diretório. Expiração ou envelhecimento observados impedem retorno. O relógio civil precisa ser não decrescente dentro da resolução. Não é prometida revogação instantânea após a leitura do diretório: C03/C06 precisam revalidar a revisão ao emitir/usar uma sessão.

Um prazo monotônico cobre as duas chamadas, além do temporizador que sinaliza abort. Isso impede aceitar o resultado depois do prazo só porque um verificador síncrono bloqueou o event loop e atrasou o timer. Nenhuma tarefa pode interromper sincronicamente código arbitrário dentro do processo; o resultado é recusado no ponto de controle seguinte. Cancelamento impede a próxima etapa e resultados tardios não produzem correspondência. Rejeições tardias são observadas. Não há retry automático nem cache de identidade.

Erros do verificador, diretório e relógio são trocados por mensagens locais seguras; o módulo não confia em status/code arbitrários lançados por eles. Dados normalizados aceitam somente propriedades de dados explícitas, sem executar getters/toJSON/proxy traps. Isso não torna confiável um processo ou adaptador comprometido.

## Verificação executada

- EntradaC01: SHA2566224ff35198911e835fcc0323bfa0e0e5c1a1fae8ff61605ced0c53fcde1b005.67 arquivos cumulativos mantidos sem alteração.
- Baseline local:99/99 —59 testes de manifesto candidato e40 do diagnósticoC01.
- RED domínio39/39 e resolvedor37/37 por interfaces ausentes; implementação inicialGREEN76/76.
- Revisão:4casos adicionais; RED3/PASS1. Corrigida ausência de discriminador humano explícito e atraso do temporizador. GREEN80/80 novos.
- Quatro mutações detectadas: ignorar namespace3falhas, selecionar primeiro duplicado1, aceitar revogado3, confiar só no timer1. Fonte correta restaurada.
- Final local combinado:179/179, zero falhas/skips/cancelamentos/TODO. Não inclui as393 regressõesI nem a suíte integral do repo.
- Typecheck focal TypeScript5.8.3, libES2023, tiposNode25.1.0 globais, exit0. Não é instalação pinada; @types/node do projeto continua22.15.30.

## Fronteira da entrega

SQL17, upgrade, CI integral, browser, build/audit/CodeQL e revisão independente NÃO executados nesta rodada. Os31cenáriosE/G continuam pendentes. As12 migrations originais não foram reescritas; os SQLD/E/G do pacote anterior permanecem byte a byte iguais. Nenhum grant, fator MFA, owner, coorte ou escopo de Thiago foi modificado.

O pedido de próximo ciclo foi usado para preparar este componente independente, não para marcar C01 concluído. Contrato da origem continua não recuperado/qualificado. Conferir `NOVO-GEO-C02-QUALIFICACAO.md` e o plano do ciclo antes de integrar.

## Critério de conclusão ainda não atingido

Qualificar origem; implementar as portas reais; adaptar integridade de humanos/credenciais no PostgreSQL com migrationCLI, FKs/uniqueness e upgrade dos usuários antigos; revalidar helpers, ACL e sessão por pessoa. Executar fonte completa, gerar CI atual e revisão independente. Não ligar `resolve` às rotas ou criar um registro por mera existência do recibo desta camada.
