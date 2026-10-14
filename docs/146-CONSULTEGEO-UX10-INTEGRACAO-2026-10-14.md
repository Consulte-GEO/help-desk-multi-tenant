# Consulte GEO — integração UX10 e continuidade da jornada

A M09c foi concluída antes desta integração: abertura atômica PostgreSQL, protocolo, snapshot, evento, fila e recibo, qualificados na CI38505830238. O delta UX01–UX10 foi portado sobre esse checkpoint em branch própria. Fonte final `5170e05c6f4f66bd935c75b3cbbb0f3ef41b8dfa` qualificada na [CI original 38516252764](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38516252764): 4.701 aplicação,420 PostgreSQL17 e539 interface, total5.660, zero fail/cancel/skip/todo. A qualificação anterior da M09c permanece histórica.

## Integração

O pacote fornecido foi conferido em 230 checksums. As 133 bases visuais e as 24 transformações reversíveis do app correspondiam à operação atual. O aplicador original recusou os três metadados evoluídos pela M09c: versão, package e manifesto de migrations. O port manual preservou esses metadados, writers, flags, lock, SQL, histórico de transferência e contratos operacionais. A prova inicial está em evidence/consultegeo-ux10/preflight.json e port.json. Depois do overlay, o adaptador intake e o wizard receberam a correção própria do mínimo Unicode do assunto, demonstrada por RED/GREEN.

Marca Consulte GEO, temas claro/escuro, navegação responsiva, caixa/detalhe, abertura em três etapas, feedback por campo, portal, configuração, administração, operações e apoio coexistem com os componentes anteriores. O texto de apresentação foi ajustado à operação Consulte GEO. Copiar um asset não monta nem habilita um recurso. A interface distingue confirmação incerta, recusa, conflito e leitura indisponível; saída limpa conteúdo e invalida respostas atrasadas.

As portas DOM dos testes foram atualizadas para reparenting, replaceWith, comentários e eventos reais. Os testes de boolean seguem o select visual. As bancadas HTTP servem apenas o grafo público explicitamente listado, incluindo novos imports de JS/CSS. A navegação dos testes usa os controles visíveis de revisão, filtros e ações recolhíveis; nenhuma asserção de isolamento, privacidade, idempotência ou recuperação foi retirada. Navegação durante envio pendente é recusada; troca explícita de sessão continua conferindo que a confirmação anterior não adota os dados da nova pessoa.

## Composição e limites

Um cenário PostgreSQL nativo compõe createHumanSession, createSessionFetch, createConsulteGeoIntakeApi, estado do intake, handlers M09b/M09c e stores reais. Salva o rascunho, confere prévia sem efeito, perde o ACK após COMMIT e concilia o recibo original: mesma chave/corpo, um ticket, um incremento de contador e uma fila. Identidade e origem são fixtures explícitas nesse ensaio; não comprovam conexão externa.

Em 14/10, o usuário decidiu: “nao precisa conectar deixe essa etapa para depois”. M08 está adiada. Não usar dados de bancada no produto. Atendimento hospedado continua fechado até a sua instalação e autorização próprias; nenhuma migration remota, registro no GlobalCad ou email real foi executado. API/interface0.30.0, schema candidato0.23.0, 16 migrations e contrato53/124/45/287/38 preservados.

## Validação

Compatibilidade RED17/7/10 → GREEN17/17; regressões de portas/build38/38; focal visual/transporte186/186; wizard Unicode RED15/14/1 → GREEN18/18; typecheck/build/contratos passaram. Build81 assets,102 referências,zero falhas. A execução local não substitui a qualificação Linux/PostgreSQL17 original.

O runner visual passa a integrar o gate original de interface, além das dez suítes existentes. Confere contagens, casos, escopo, fonte por SHA256 e relatórios gerados somente pela invocação atual. 190 verificações da jornada e136 do app completo incluem cinco larguras, dois temas, teclado, clear, respostas tardias e conciliação; o app/controlador original não é substituído. HTTP/CSP/MIME são cobertos separadamente pela suíte original, inclusive seis assets nativos adicionais.

Os seis gates originais passaram: lock, instalação limpa, auditoria, aplicação/tipos/contratos/build, PostgreSQL17 e interface. Logs originais e inventário foram importados com verificação de SHA256, contagens e fingerprint `9c2daade5879a279a01c821a4ec40c8baff9a21996a5cc1b3810e1ca2fed4a90`. O inventário nativo confere com o contrato estático53/124/45/287/38. A interface inclui213 verificações originais de HTTP/browser e326 visuais, mantendo o limite global e sem skips. A inspeção original integration:check aprovou o delta em um derivado textual auditado contra M09c (inventário em integration-check.json); duas PNGs têm checksums separados e build/browser próprios. Não é aceitação pelo aplicador GPT antigo.

Revisão única:0Critical,2Important,1Minor original. Corrigidas a perda de intenção ao navegar e a recusa de replay que liberava nova operação; a mesma lacuna foi corrigida em membros. O Minor Unicode foi reclassificado Important pelo bloqueio confuso da prévia e corrigido no campo montado. As três superfícies de estado e o guard do app receberam ajustes explícitos após o overlay; não são alegados byte-idênticos ao pacote. Nenhuma falha ficou dispensada ou minor adiado. RED/GREEN,71 regressões focais e180 de visual/admin passaram; a CI completa acima confere a fonte final. [Revisão](../evidence/consultegeo-ux10/review-final.md), [ledger](../evidence/consultegeo-ux10/execution-ledger.md), [qualificação](../evidence/consultegeo-ux10/qualification.json).

As três tentativas anteriores estão preservadas como diagnóstico:38513544499 recusou o texto antigo forbidden,38515058481 detectou o sentinel de review-state que mudou deliberadamente no fix,38515648569 recusou o recibo visual agregado antigo. Os testes foram adaptados às regiões/ações reais sem retirar cobertura ou favorecer um resultado artificial. O Windows também conservou suas falhas de ambiente, portas iniciais e logs; sua bancada parcial não foi usada como qualificação Linux.

O pacote cumulativo contém source completo e evidência atual, com manifesto/checksums conferidos. ZIP e hash ficam em evidence/consultegeo-ux10/delivery.json; não é instalador nem promoção hospedada.

## Plano atualizado

1. UX10/composição qualificados e disponibilizados na continuidade do PR31 draft; não mesclado ou ativado em produção.
2. Prosseguir com o host da jornada e sua instalação de teste quando houver origem/identidade autorizadas; M08 real adiada por decisão do usuário. O catálogo do servidor deverá fornecer conta, obras, versões e capabilities atuais.
3. M10: executar checklist, conversa, aprovações/correções, conclusão, reabertura e transferência nas portas publicadas, conservando snapshots e permissões. Não declarar cinco jornadas operacionais sem lookup/anexos qualificados. Implantação aceita somente planilha; DWG não retorna.
4. M11: ligar relógios e worker Resend à outbox existente, webhook autenticado, retry/dead-letter e conciliação de entrega. O template Consulte GEO e os componentes reaproveitados do GeoLab permanecem como base; pending comprova fila, não envio.
5. M12: ensaio hospedado e piloto com usuários autorizados, calendário vigente, último protocolo legado conferido, destinatários e remetente Resend verificados. Publicação técnica e liberação de atendimento têm aceites próprios.

A matriz de 107 requisitos conserva prioridades e identificadores; a apresentação visual e o ensaio nativo ampliam entregas parciais, sem promover integração externa ou operação de email a concluída.
