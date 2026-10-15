# Pré-importação — contrato mínimo de campos · v5.22.45

## Escopo

Este documento é a régua da **Pré-importação** de
`frontend/public/importa.html`. Ela converte registros de concretagem/caminhão do
Excel do cliente para o layout de importação do Consulte GEO. Não deve pedir
dados do cadastro de implantação que não entram nesse arquivo.

O contrato `criar_obra(jsonb)` de
`frontend/src/services/geoControleExportService.ts` é um alvo separado do wizard:
ele cria obra, concretos, tipos, grupos, peças, usuários e fornecedores. A
Pré-importação não coleta município, UF, gestor, padrão de moldagem ou outros
campos desse contrato apenas para satisfazer o wizard.

## Conjunto mínimo real

Campos bloqueantes por linha: **Data Concretagem, N.F. DANFE, Volume, Bloco,
Unidade, Concreto, Usina e Laboratorio**.

Campos gerados/padrão: **Número Concretagem** é sequencial por
data+bloco+unidade; **Placa** recebe `IMPORT` quando ausente.

Campos opcionais: Peça, Slump, Flow, quatro horários, Observação Entrega e
resultados de rompimento por idade detectada. As idades não precisam estar em um
cadastro interno para a coluna ser preservada; a ausência de cadastro vira
informação para revisão, não descarte.

## Matriz campo → origem → obrigatoriedade

| Campo final | Tipo | Obrigatório | Origens aceitas | Normalização/associação | Validação final | Proveniência esperada |
|---|---|---:|---|---|---|---|
| Número Concretagem | inteiro | gerado | sistema | sequência estável após ordenar por data, bloco, unidade e linha | sempre preenchido no export | `NORMALIZACAO_AUTOMATICA` |
| Data Concretagem | data `dd/MM/yyyy` | sim | coluna do cliente; expansão de célula mesclada | serial Excel, texto pt-BR e data nativa | não futura; data antiga gera alerta | original ou normalização; mescla registra a célula de origem |
| N.F. DANFE | texto | sim | coluna do cliente | preservar, remover pontuação final ou manter só dígitos conforme configuração | vazia bloqueia; repetida na mesma usina bloqueia; em usinas distintas alerta | original/normalização |
| Volume | decimal m³ | sim | coluna; padrão operacional explicitamente autorizado | número pt-BR, remoção de unidade `m³` | `0 < volume ≤ 16` por padrão | original/normalização ou `PADRAO_OPERACIONAL` |
| Placa | texto | não | coluna; padrão `IMPORT` | trim | sem bloqueio | original ou `PADRAO_OPERACIONAL` |
| Bloco | texto | sim | coluna; associação de estrutura escolhida pelo operador | match exato no cadastro; candidatos por similaridade | se catálogo foi fornecido, deve pertencer a ele | original/normalização/inferência aceita/pendência |
| Unidade | texto | sim | coluna; associação de estrutura escolhida pelo operador | match exato no par bloco+unidade; candidatos por similaridade | se catálogo foi fornecido, deve pertencer ao bloco | original/normalização/inferência aceita/pendência |
| Peça | texto | não | coluna de peça/local + contexto estrutural | composição sem duplicar tokens | sem bloqueio | original ou normalização |
| Concreto | texto | sim | coluna de traço; match exato; proposta por FCK+aplicação | com 1 candidato compatível propõe; com 2+ exige escolha | se catálogo foi fornecido, deve pertencer a ele; conflito de FCK bloqueia | original/normalização/inferência aceita/pendência |
| Slump | decimal cm | condicional | valor medido; proposta do nominal do traço | faixa vira nominal; mm→cm só com evidência; tolerância não é copiada | `0–30`; requerido quando o traço oficial é SLUMP; fora da tolerância alerta | original/normalização/inferência aceita/pendência |
| Flow | decimal cm | condicional | valor medido; proposta do nominal do traço autoadensável | análogo ao Slump | `0–70`; requerido quando o traço oficial é FLOW | original/normalização/inferência aceita/pendência |
| Usina | texto | sim | coluna; valor único observado nas outras linhas | match exato/normalizado; vazio pode receber proposta única | se catálogo foi fornecido, deve pertencer a ele | original/normalização/inferência aceita/pendência |
| Laboratorio | texto | sim | coluna; valor único observado nas outras linhas | análogo à Usina | se catálogo foi fornecido, deve pertencer a ele | original/normalização/inferência aceita/pendência |
| Hora Carregamento | hora `HH:mm` | não | coluna | normalização de hora Excel/texto | sem bloqueio | original/normalização |
| Hora Chegada | hora `HH:mm` | não | coluna | normalização de hora Excel/texto | sem bloqueio | original/normalização |
| Hora Inicio | hora `HH:mm` | não | coluna | normalização de hora Excel/texto | sem bloqueio | original/normalização |
| Hora Final | hora `HH:mm` | não | coluna | normalização de hora Excel/texto | sem bloqueio | original/normalização |
| Observação Entrega | texto | não | coluna | trim; também fornece contexto, sem substituir o dado | conflito textual de FCK vira pendência | original/normalização |
| Rompimento `<idade>` | decimal MPa | não | qualquer coluna de resultado cuja idade seja detectada no cabeçalho | número pt-BR; zero pode virar vazio | numérico, `>0` e `≤150`; idade não cadastrada é preservada com aviso | original/normalização |

## Regras determinísticas de similaridade

1. **Slump ← traço:** extrai `SLUMP` ou `ABATIMENTO`; usa apenas o nominal.
2. **Flow ← traço:** extrai `FLOW`/espalhamento e não cria Slump.
3. **Traço ← FCK + aplicação:** um candidato vira proposta; múltiplos candidatos
   permanecem sem valor até escolha humana.
4. **FCK textual:** usa `extractFcksFromText` do IntakeAuditor. Divergência com
   campo dedicado é pendência, nunca resolução automática.
5. **Usina/Laboratório únicos:** propõe o único valor não vazio observado.
6. **Placa:** `IMPORT` sem pergunta.
7. **Volume:** somente quando `volumeDefaultAuthorized=true`.
8. **Célula mesclada:** valor expandido é rastreado como normalização.

## O que não é solicitado pela Pré-importação

Código/município/UF da obra, gestores, projetista, usuários da obra, CNPJ,
padrões de moldagem oficiais, idades oficiais obrigatórias, IDs de tabelas
internas e demais metadados do `criar_obra`. Esses dados pertencem ao wizard de
implantação ou à validação interna posterior.

## Exportação e auditoria

A pasta de trabalho gerada contém:

- `Importação`: somente o layout operacional, sem colunas técnicas extras;
- `Proveniência`: uma linha por campo rastreado com aba/linha original, valor,
  origem, regra/detalhe, valor original e aceite do operador.

Valores rejeitados permanecem vazios e são marcados `PENDENTE_CLIENTE`. Um valor
presente na planilha nunca é substituído por proposta.
