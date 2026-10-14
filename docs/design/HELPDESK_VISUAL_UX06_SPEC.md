# UX06 — Operação, evidências e decisões

## Objetivo
Adaptar checklist interno, anexos privados, aprovação, revisão de formulário e consulta de entrega ao design system Consulte GEO já estabelecido. Preservar o núcleo genérico, o controle de acesso do servidor, a revisão e a idempotência.

## Desenho adotado
- Checklist: mesmo mount/controlador; progresso de itens obrigatórios com texto e barra nativa; badges semânticos; evidência, motivo e risco separados; revisão explícita e navegação com foco estável.
- Anexos: seleção local visível e removível antes de iniciar; limites já existentes (50 arquivos, 100 MiB por arquivo); extensão apresentada pelo seletor original (PNG/JPEG/PDF). Transferência, análise e autorização final não se confundem. Nenhum download público, polling ou retry automático.
- Aprovação: conferir convite → escolher decisão e justificar → revisar → confirmar. A etapa visual de revisão não cria token nem intenção; o controlador existente cria a intenção somente na confirmação. Resultado incerto exige a mesma intenção.
- Revisão: consulta explícita do rascunho salvo; diferenças públicas em Antes/Depois, nunca propriedades extras do DTO; botão de confirmação apenas no estado apropriado; obtenção assíncrona do rascunho tem trava local e descarte após clear/destroy.
- Entrega: rótulos e tons para todos os nove estados atuais, tentativas e horário quando disponíveis; consultar evidência não reenvia. Aceita pelo provedor não equivale a entregue.

## Limites
Nenhuma montagem automática, alteração em Auth/scopes, banco, migrations, provedores ou liberação operacional. Nenhuma alteração dos controladores de checklist e revisão, do validador de evidências, nem dos algoritmos de lote/TUS. Alterações de UI não são autorização. Nenhuma credencial, URL de upload, corpo de nota interna ou resposta bruta do provedor no DOM. Campos são limpos ao encerrar. Recursos avançados anteriores permanecem desativados.

## Aceite local
Testes RED/GREEN; Node do subconjunto; Chromium com controladores reais e portas fictícias, 320/390/768/1024/1440 px e claro/escuro; duas montagens; teclado/foco; resultado incerto com mesma chave/corpo; cancelamento e retorno; dispensa/risco/evidência; textos longos; fonte CSS isolada; sem overflow da página. O host autenticado, o scanner e o PostgreSQL reais continuam G0 até evidência própria.
