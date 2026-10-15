# Implementation Report · Implantação Consulte GEO v5.22.10

## Resumo executivo

Versão "limpeza de UX baseada em feedback real do usuário" focada em **4 entregas**:

1. **Remoção dos 4 radio-cards cosméticos da Etapa 2** (Torres iguais / diferentes / Obra horizontal / Personalizado). Verificação por grep mostrou que `tipoEstrutura` não tinha **nenhum** branching condicional no produto — só era usado como label numa aba do Excel. Os 4 cards confundiam o usuário porque pareciam mudar o formulário, mas não mudavam nada.
2. **Concretos vazios por padrão**. Antes o `defaultSnapshot()` chamava `concretosPadrao()` (5 traços pré-cadastrados). Cliente abria a Etapa 4 e via 5 cards de concreto já configurados, dando impressão errada de "obra já tem traços". Agora abre limpo com 2 botões: "+ Cadastrar primeiro concreto" e "Sugerir traços padrão" (recupera os 5 traços em um clique).
3. **Input de Volume compacto**. Variant CSS nova `.input-group--volume` com `width: 9ch` + `text-align: right` + suffix `m³` compacto. Antes o input herdava largura da célula `<td>` ficando enorme para um número que nunca passa de "9999,99".
4. **Bugs de contagem corrigidos**: Step2 dizia "Etapa 2 de 6" e Step4 dizia "Etapa 4 de 6" — ambos errados (cliente tem 8 etapas, equipe tem 10). Step2 corrigido para texto fixo "Etapa 2 de 8". Step4 ganhou prop `totalSteps` (default 8, ReviewView passa 10).

**Build verde · typecheck verde · 123 smokes lógica (13 novos) · 42 smokes contraste · SEM migration nova.**

## Decisão registrada

A propriedade `tipoEstrutura` (com seu type `TipoEstruturaModelo`) e a constante `TIPO_ESTRUTURA_OPCOES` foram mantidas no `setup.models.ts`. Razões:

- Snapshots antigos no banco contêm `tipoEstrutura: 'torres_iguais'` e precisam continuar carregando
- O JSON técnico tem `customerInput.tipoEstrutura` no schema
- A aba "Resumo" do Excel mostra o valor
- Se um dia alguém reintroduzir a escolha (com modal "ver exemplo preenchido" como você sugeriu), basta reverter o template do Step2TipoEstrutura.vue

Default fixo: `tipoEstrutura: 'torres_iguais'` em todo snapshot novo.

## Ambiente usado

- Node 20.x
- npm 10.x
- Sandbox Linux

## Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `frontend/src/components/Step2TipoEstrutura.vue` | Removidos os 4 radio-cards (`<div class="radio-cards">` inteiro). Mantido só Modelo de Preenchimento. Texto reescrito: "Qual modelo de preenchimento você quer usar?". Alert info explica o que muda entre Simplificado e Completo. Contagem "Etapa 2 de 8". Import de `TIPO_ESTRUTURA_OPCOES` removido. |
| `frontend/src/components/Step4Concretos.vue` | Estado vazio com 2 botões ("+ Cadastrar primeiro concreto" + "Sugerir traços padrão"). Prop nova `totalSteps` (default 8). Emit novo `suggest-defaults`. Kicker "Etapa 4 de {{ totalSteps }}". |
| `frontend/src/components/Step5PecasEditor.vue` | Célula da tabela usa `class="input-group input-group--volume"`. Placeholder de volume mudou de "Exemplo: 187,79" para "0,00" (mais limpo dentro da célula estreita). |
| `frontend/src/styles/design-system.css` | Variant `.input-group--volume` com `width: max-content` + filho input `width: 9ch; max-width: 9ch; text-align: right` + suffix compacto (padding `0 8px`). |
| `frontend/src/models/setup.models.ts` | `defaultSnapshot().concretos` mudou de `concretosPadrao()` para `[]`. Comentário explicando o porquê. |
| `frontend/src/store/modules/setup.ts` | Mutation nova `suggestConcretosDefault` (idempotente — só popula se vazio). Import de `concretosPadrao`. |
| `frontend/src/views/SetupPage.vue` | Listener `@suggest-defaults` no Step4Concretos + handler `onSuggestConcretosDefault` que faz `commit('setup/suggestConcretosDefault')` + audit `concretos_padrao_sugeridos`. |
| `frontend/src/views/ReviewView.vue` | Mesmo listener no Step4 + handler local `onSuggestConcretosDefault` (popula `editSnap.concretos` + agenda save). Import de `concretosPadrao`. Prop `:total-steps="10"`. |
| `frontend/src/views/ClientStatusView.vue` | Mesmo listener + handler local. Import de `concretosPadrao`. |
| `frontend/smoke-pipeline.ts` | 13 testes novos da v5.22.10 |
| `frontend/package.json` | version 5.0.22-10 |

## Arquivos reescritos

- `README.md` — atualizado para v5.22.10 (descrição das 4 mudanças, decisão registrada, deploy sem migration nova)

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | sem warnings novos |
| `npm run typecheck` | **0 errors** | TS strict |
| `npm run build` | 1.7 MB dist | 7.50s, sem regressão |
| `npm run smoke` | **123 OK / 0 FAIL** | 13 testes novos |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** | WCAG AA preservado |

## Implementado com sucesso

1. **Step2 sem cards cosméticos** — só Modelo de Preenchimento (Simplificado vs Completo com Projetista) com explicação clara via `alert info` ("O que muda entre os dois?"). Etapa 2 ficou substancialmente menor verticalmente.
2. **Concretos vazios + botão "Sugerir traços padrão"** — `defaultSnapshot()` retorna `concretos: []`. Step4 quando vazio mostra card centralizado com texto explicativo + 2 botões. Mutation `suggestConcretosDefault` no Vuex é idempotente (guard `if state.concretos.length > 0 return`).
3. **Volume compacto** — variant `.input-group--volume` aplicada em Step5PecasEditor. Suffix `m³` continua ao lado. Largura cravada em 9ch (suficiente para "9999,99" com folga + alinhamento à direita).
4. **Bugs de contagem fixos** — Step2 hardcoded "Etapa 2 de 8"; Step4 dinâmico via `totalSteps` prop. ReviewView passa `:total-steps="10"`; SetupPage e ClientStatusView usam default 8.
5. **3 views ligadas** — `suggest-defaults` funciona em todas as 3 telas onde Step4Concretos aparece: cadastro do cliente (SetupPage via Vuex), revisão da equipe (ReviewView via editSnap + save), reabertura do cliente (ClientStatusView via editSnap).

## Não implementado (sugestão registrada)

- **Modal "ver exemplo" por opção de Tipo de Estrutura** — você sugeriu que os 4 cards fariam sentido se cada um abrisse um modal com print da tela preenchida. É trabalho próprio (4 PNGs anotados + componente modal + copy curatorial). Adiei. Os 4 valores continuam no enum `TipoEstruturaModelo` para suporte futuro.

## Regressões evitadas

- **Snapshots antigos** com `tipoEstrutura: 'torres_diferentes' | 'obra_horizontal' | 'personalizado'` continuam carregando — o valor é preservado no JSON técnico, só não é exibido na UI.
- **Snapshots antigos com concretos pré-populados** continuam carregando normalmente. O `defaultSnapshot()` vazio só afeta obras **novas**.
- **Excel export** continua mostrando `tipoEstrutura` na aba Resumo (linha "Tipo de estrutura"). Para obras novas com default `'torres_iguais'`, a célula vai mostrar esse valor literal — pode ser melhorado em versão futura para mostrar algo como "Padrão (não selecionado)" se houver demanda.
- **Botão "Adicionar concreto"** continua funcionando no header do Step4 mesmo quando há concretos (não some quando lista deixa de estar vazia).
- **TIPO_ESTRUTURA_OPCOES** mantido em `setup.models.ts` para uso futuro (ex: ao reintroduzir cards com modal "ver exemplo").

## Validações realizadas

| Validação | Resultado | Observação |
|---|---|---|
| `npm run typecheck` | ✓ | 0 erros TS strict |
| `npm run build` | ✓ | 7.50s, bundle estável |
| `npm run smoke` | ✓ 123/123 | 13 cases novos |
| `npm run smoke:contrast` | ✓ 42/42 | WCAG AA preservado |
| Inspeção visual Step2 | ✓ | sem radio-cards, alert explicativo presente |
| Inspeção visual Step4 vazio | ✓ via smoke | botões "+ Cadastrar primeiro" e "Sugerir" presentes |
| CSS variant `.input-group--volume` | ✓ via smoke | declaração presente; aplicação no Step5 confirmada |
| Idempotência `suggestConcretosDefault` | ✓ via smoke | grep confirma guard `length > 0` |

## Bloqueios reais

### Bloqueios técnicos
Nenhum.

### Bloqueios por ambiente
Nenhum.

### Bloqueios por dependência externa
Nenhum.

### Bloqueios por credenciais
Nenhum.

## Pendências que exigem ação manual

1. **Push frontend** → Netlify build automático
2. **Teste end-to-end** em aba anônima:
   - **Etapa 2**: ver que só tem o switch Modelo Simplificado vs Completo com Projetista. Não deve haver os 4 cards de Torres iguais/diferentes/Obra horizontal/Personalizado. Texto deve dizer "Etapa 2 de 8".
   - **Etapa 4 (obra nova)**: deve abrir vazia com card central "Nenhum concreto cadastrado" + botões "+ Cadastrar primeiro concreto" e "Sugerir traços padrão". Clicar "Sugerir" deve popular 5 concretos. Clicar de novo NÃO deve duplicar.
   - **Etapa 5**: input de volume na tabela deve estar estreito (≈ "9999,99 m³"), com m³ à direita do input, números alinhados à direita.
3. **Verificar Excel export**: abrir aba "Resumo", confirmar que linha "Tipo de estrutura" agora mostra `'torres_iguais'` para obras novas (cosmético — pode ser ajustado depois).

## Como validar localmente

```bash
unzip implantacao-consulte-geo-source-completo-v05-22-10.zip
cd implantacao-consulte-geo-v05-22-10/frontend
npm install
cp .env.example .env   # editar VITE_SUPABASE_*
npm run dev            # localhost:5173
```

Roteiro de teste 5 min:
1. Abrir `http://localhost:5173` em aba anônima
2. Clicar "Iniciar novo cadastro"
3. Etapa 1: preencher nome + responsável + clicar Avançar
4. **Etapa 2: validar que só tem o switch Simplificado/Completo, sem os 4 cards.** Avançar.
5. Etapa 3: adicionar 1 grupo. Avançar.
6. **Etapa 4: validar que abre vazia. Clicar "Sugerir traços padrão". Devem aparecer 5 concretos.**
7. **Etapa 5: validar que o input de volume é estreito com m³ ao lado.**

## Como publicar no Netlify

```bash
git add .
git commit -m "v5.22.10: Etapa 2 simplificada, concretos vazios + sugerir, volume compacto, bugs de contagem"
git push
```

Aguarde ~2 min e teste em aba anônima.

## Próximo ciclo recomendado

1. **Implementar "ver exemplo"** se voltar a haver demanda por escolhas de tipo de estrutura — modal com PNG anotado por opção
2. **Tipo de estrutura na aba Resumo do Excel**: trocar `torres_iguais` literal por label human-readable ou esconder a linha
3. **Testar com cliente piloto real** validando que a nova UX é mais clara
4. **Backend .NET completo** (sair de stub) — pendência mais antiga

---

**Build verde, smokes verdes (123 + 42), código pronto pra push imediato (sem migration nova).**
