# Incidentes e contenção — candidato C15/C16

**Procedimento preparado, não homologado.** Nenhum responsável nominal, alçada, prazo comercial ou canal de plantão foi inventado.

## Gatilhos para fechar uma coorte

Divergência de fonte/schema/configuração/provedor; prova expirada ou chave revogada; recurso/tenant indevido; confirmação de entrega contraditória; ausência do controle retido de recuperação; invalidação de membro; falha que comprometa confidencialidade/integridade. A decisão é registrada por pessoa com MFA e capacidade de contenção, com motivo e revisão.

## Sequência

Identificar conta/instância/categoria/canal/escopo afetados e registrar IDs técnicos mínimos, horário UTC e referência do incidente, sem senha, bearer, QR, conteúdo privado, URL assinada ou payload do IdP. Efetuar contenção pelo comando específico ou pelo controle operacional já homologado; não editar o JSON de evidência para fabricar aceite.

Verificar em requisições novas que a coorte foi fechada. As transações que já possuíam locks podem terminar antes da contenção serializada; medir essa janela no SQL real. Fechar o piloto não recolhe dados baixados nem desfaz e-mail aceito/enviado. Travar reenvios unknown; consultar ledger antes de qualquer conciliação.

Conservar recibos, snapshots publicados e evidências do incidente. Corrigir e testar a causa; obter nova evidência/atestação e nova revisão de release antes de preparar retomada. Não reutilizar a mesma liberação contida. Uma falha de confirmação administrativa é unknown: consultar registro e repetir somente a mesma intenção explicitamente, não gerar outra chave.

## Pendências

Playbook de atendimento fora do ar, alertas reais, responsável de segurança/continuidade, autoridade emissora, fallback de contenção quando MFA/controle está indisponível e exercício real precisam de aceite. Não desligar MFA nem promover o solicitante por e-mail para contornar uma falha.
