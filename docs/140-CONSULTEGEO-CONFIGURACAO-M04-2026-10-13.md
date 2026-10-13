# Consulte GEO — configuração e publicação M04

> Checkpoint M04 preservado. O upgrade M05 foi desenvolvido e homologado na mesma branch; o [relatório M05](141-CONSULTEGEO-UPGRADE-M05-2026-10-13.md) descreve o estado mais recente. A instalação hospedada e a montagem M06 continuam próprias da promoção futura.

Data: 13/10/2026. Base do incremento: `fe1ecad950dce5b3a8c89d61f7cacfb1f8e45858`. Branch `codex/consultegeo-m02`; [PR31 em draft](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/31). Esta etapa implementa configuração, prévia e publicação versionada de formulários, workflow, checklist e SLA para a Consulte GEO, sobre o writer M02/M03. A publicação foi ensaiada em PostgreSQL 17 descartável; a instalação e montagem hospedadas pertencem a M05/M06.

## Conjunto publicado

A unidade de publicação é uma família de atendimento com todas as suas ações/prioridades, calendário e regras. Um conjunto incompleto não publica. São seis famílias e treze entradas iniciais:

| Família | Entradas | Primeira resposta / solução |
|---|---|---|
| Acesso de usuário | Incluir, alterar, desativar, reenviar acesso, liberar em nova obra | 4 / 10 horas úteis |
| Dúvidas | Solicitação | 4 / 10 horas úteis |
| Backup | Solicitação | 4 / 30 horas úteis |
| Implantação de nova obra | Solicitação | 8 / 70 horas úteis |
| Ajuste de estrutura | Solicitação | 4 / 30 horas úteis |
| Relatar problema | Urgente, alta, normal, baixa | 1 / 10; 2 / 10; 4 / 10; 8 / 30 horas úteis |

Os formulários usam a DSL existente em um recorte de oito tipos: texto curto, texto longo, booleano, seleção, referência autorizada, arquivo, orientação e download qualificado. Orientações e checklists iniciais vêm da política Consulte GEO. Desativação requer confirmação específica e item de execução sensível; as outras ações mantêm suas informações e verificações próprias. Os grupos solicitados são informações para a equipe: nenhuma opção do formulário concede acesso no GEO.

Implantação e ajuste exigem planilha, com política XLSX/CSV até 15 MiB. Arquivos, referências de pessoas e downloads só publicam quando constam de um registry privado qualificado. Não há upload, execução na origem ou download arbitrário por uma definição. Os seis modelos em `profiles/consultegeo/configuration-drafts.v1.json` permanecem rascunhos; o arquivo não cria registros automaticamente. A lista de feriados vazia dos modelos é explícita e deve ser conferida antes de sua publicação real.

O workflow mantém a máquina de estados M02/M03, com checklist vinculado e janela de reabertura configurável de 0 a 30 dias; o padrão é sete. Não oferece um grafo de transições arbitrárias. Primeira resposta e solução são inteiros de 1 a 2.000 horas úteis, com primeira resposta menor ou igual à solução. Aguardando cliente pausa solução. A execução dos relógios permanece em M11.

## Calendário e versões

Cada definição informa início, fim exclusivo e feriados, em um horizonte de 1 a 366 dias. O horário é segunda a sexta, 08h–18h, America/Sao_Paulo. O compilador converte horários locais para intervalos UTC e confirma a conversão; não presume um deslocamento fixo. O PostgreSQL recompila os mesmos artefatos independentemente e exige igualdade integral antes de gravá-los.

Salvar modifica somente o rascunho da revisão informada. Publicar calcula e grava formulário, calendário, workflow e checklist conjuntamente, com hash, autor, horário e recibo. Uma versão publicada é imutável. Preparar nova versão copia a versão publicada para uma sucessora em rascunho, sem modificar os chamados ou snapshots antigos. A função de pin vincula o intake futuro à versão/hash exatos; não substitui automaticamente pelo conjunto mais recente nem autoriza o solicitante.

Os limites são 64 KiB por definição e 500 versões / 2 MiB por catálogo. A leitura valida cada registro antes de usar o conjunto. A listagem expõe metadados; a consulta de conteúdo exige a versão explícita.

## Autorização e transação

Leitura exige `forms.read`, edição/restauração `forms.write`, publicação `forms.publish`. A aplicação exige prova administrativa MFA verificada pelo servidor, pessoa ativa e concessão explícita vigente. O SQL revalida pessoa humana, vínculo admin e capability em tabelas privadas, conserva seus locks e verifica expiração novamente no encerramento. O candidato não concede capabilities a pessoas por conta própria e não permite autoaprovação.

O catálogo e a versão usam comparação de revisão, com lock transacional e idempotência por ator/workspace. Todos os efeitos precisam gravar exatamente uma linha esperada. A admissão diferida confere recibo, versão e documentos de workflow/checklist realmente persistidos. Falta de artefato, ACK malformado ou conflito de revisão provoca rollback; uma confirmação perdida mantém resultado desconhecido e deve ser conciliada pela mesma intenção/chave.

As tabelas novas ficam privadas, com RLS forçado e sem acesso direto do app. Somente cinco funções de entrada possuem execução para o papel restrito. Helpers, compiler, capability e registry não são acessíveis diretamente pelo app. O candidato exige banco `helpdesk_test`, PostgreSQL 17, identidade de manutenção e opt-in descartável; não é uma migration hospedada. As doze migrations, API/interface 0.27.0 e schema esperado 0.19.0 permanecem intactos.

## HTTP e editor

O handler opcional atende a coleção administrativa e a consulta de uma versão exata. POST exige origem válida, JSON limitado, `If-Match`, Idempotency-Key, MFA e autorização por ação. Respostas privadas usam no-store. Desabilitado, o handler recusa antes de autenticar; nenhum parâmetro do cliente fornece grants, artefatos publicados ou autorização.

O editor mostra definição, alterações, prévia por ação, SLA, calendário, reabertura e checklist. Oferece salvar rascunho, preparar/confirmar publicação e preparar uma nova versão. Preparar não envia uma mutação; após confirmação, exige consultar a revisão atual antes de continuar. Confirmação desconhecida bloqueia outras intenções e permite conciliar a chave original. Ao encerrar o público, referências e conteúdo privado são descartados; respostas e eventos tardios não repõem a prévia.

O editor é um componente administrativo opcional, ainda não montado no portal publicado. A fixture de navegador compõe o handler/publisher reais com Auth, capabilities e armazenamento em memória sintéticos, em loopback próprio. Isso comprova o percurso da interface e não substitui o aceite do runtime hospedado.

Prévias inspecionadas: [desktop](../evidence/consultegeo-m04/screenshots/configuration-1440.png) e [celular](../evidence/consultegeo-m04/screenshots/configuration-390.png).

## Validação e revisão

CI integral aprovado na fonte `d7ecc6a9faeb108ed8ea03a17b4a02831d483cda`, [run 38441292994](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38441292994): **4.360/4.360 aplicação, 370/370 PostgreSQL 17 e 184/184 interface**, zero falhas, cancelamentos, skips ou todo. Lock, instalação limpa, audit, tipos, migrations/contratos, scan heurístico de segredos e build passaram no workflow original Linux/Node22. Os cenários novos de M04 são 42 de aplicação, 14 nativos mais seu teste pai e 16 verificações de interface; a contagem total inclui a base M02/M03.

Fingerprint: `8e6c91705a7d79350247d3c550f2aabe01816c0f9a9f28778ad5e6c4ab597320`. O relatório e os seis logs da mesma execução foram importados para `evidence/homologation`, preservando os anteriores. `npm run check:homologation` confirmou no Windows fonte, estrutura, contagens e hashes. [Origem CI](../evidence/consultegeo-m04/ci-source.json): `tests_executed:false` descreve somente a preparação da fonte; os resultados estão no relatório homologado. Documentação/evidências posteriores não alteram o fingerprint. Esta prova não equivale ao aceite Supabase/Netlify ou ao atendimento operacional.

Verificação local: 43/43 testes focais, incluindo build dos assets, zero falhas/skips, e typecheck aprovados. Chromium real: 16 verificações aprovadas em 1440 px e 390 px, sem overflow horizontal ou erros de execução. A suíte verifica preparação sem escrita, publicação via handler, imutabilidade, restauração, limpeza após evento tardio e conciliação sem segunda publicação. Os testes SQL usam o papel restrito e PostgreSQL real; as seis famílias têm comparação integral dos artefatos JS/SQL.

A revisão independente identificou e levou à correção de duas falhas: diferenças de controles/comprimento UTF-16 entre SQL e TypeScript e evento tardio do seletor após encerrar o público. As regressões foram observadas falhando antes da correção. Textos de orientação conservam quebras válidas; título raiz/motivo recusam controles; labels de checklist e condições seguem os limites do parser. Também foram corrigidos a atomicidade diante de um trigger que suprime artefato e o limite de catálogo, que anteriormente reutilizava indevidamente o limite de um único formulário.

A revisão final do código `d7ecc6a` não identificou Critical/Important restantes. Revalidou 43 focais e três respostas assíncronas tardias após limpeza. O reviewer examinou os cenários nativos e a fixture, mas não executou PostgreSQL nem presumiu a aprovação da CI: essa evidência é conferida pelo implementador. [Revisão independente](../evidence/consultegeo-m04/review-final.md).

Os CIs anteriores registram desenvolvimento: `22d92b5` revelou a supressão de artefato; `223cba4` aprovou 367/367 PostgreSQL, mas apontou a whitelist incompleta da fixture de build; `41fa873` comprovou os novos negativos de texto SQL e limpeza da interface. Não são evidência de aprovação da fonte final. Nenhum guard, policy ou teste foi removido para obter aprovação.

## Continuidade

| Bloco | Próximo trabalho |
|---|---|
| M05 | Gerar migration de upgrade, validar schema/manifest/readiness e papéis restritos; promover candidatos somente pelo processo próprio |
| M06 | Montar configuração e writer no runtime; projetar devolutiva/retorno/resolução em leitura pública restrita pelo mesmo evento/revisão |
| M08 | Qualificar registry e referências reais de pessoas/obras do Novo GEO, preservando ACL completa |
| M09/M10 | Compor formulários e jornada de solicitante/N1 com a configuração exata publicada |
| M11 | Storage/scan, relógios e acompanhamento de SLA; modelos, worker/persistência Resend e webhook de entrega |
| M12 | Piloto e aceite hospedado |

Configuração publicada não habilita atendimento nem envio de e-mail. Não houve registro no GlobalCad, envio real, alteração hospedada de Auth/grants, migration remota, merge ou deploy de produção nesta etapa. O PR continua draft; a prévia automática do pipeline não constitui aceite operacional. O próximo bloco de engenharia é M05.
