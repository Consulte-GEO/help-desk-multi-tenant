# Origem legado — qualificação pendente para C18

Este roteiro se destina ao responsável técnico da origem. Não é um contrato verificado, não autoriza exportação ou importação e não substitui o aceite da V1. Não enviar senhas, tokens, chaves de conexão ou dados reais desnecessários em Git/documentos públicos.

## Acesso vivo

Identificar o repositório, versão e especificação realmente disponíveis. Confirmar se há pessoa individual estável e emissor/subject verificáveis; demonstrar como contas compartilhadas são distinguidas de pessoas. Não usar e-mail, empresa, nome ou protocolo para associar identidades.

Comprovar suporte OIDC, caso exista. Na ausência desse suporte, revisar o desenho do handoff servidor opaco, de uso único e prazo curto antes de qualquer implementação: audiência, pessoa, vínculo, contexto, replay, revogação, consumo concorrente e custódia. O módulo de histórico desta entrega não implementa nem testa esse login.

Mapear sistema/conexão/tenant/tipo/ID para workspace/conta/instância/binding sem SQL direto à origem pelo Help Desk. Informar cardinalidade, IDs com zeros, registros globais, obras revogadas/encerradas, permissões em múltiplas obras e estratégia de revisão atual da autorização. Confirmar como revogações chegam e como se evita uma resposta tardia restaurar um vínculo.

## Histórico, somente após decisão específica

Definir exatamente dados, período, retenção, audiência, participantes e anexos autorizados. Não assumir 24 meses, faixa de protocolo, todas as obras ou todos os tickets. Separar exportação autorizada, inspeção, staging e escrita final; cada etapa precisa do responsável e evidência correspondentes.

Fornecer formato real e versão do exportador, contagens, hash de cada payload, versões imutáveis dos objetos, manifest do lote e origem das decisões. Demonstrar vínculo dos anexos e varredura; `clean` sem proveniência não é aceite. Informar limites e casos não suportados, inclusive conteúdo comprimido e macros. O envelope `LegacyHistoryBatch` do Help Desk é normalizado interno: não presumir que a origem já o produza.

Manter um índice idempotente por sistema/conexão/tenant/tipo/ID e um registro independente de exclusões/revogações. Demonstrar tratamento de IDs repetidos, mudança de CódigoLegado, conteúdo alterado e nova revisão de mapeamento. Confirmar que logins compartilhados serão autores históricos desconhecidos, nunca logins ativos.

A importação eventual será somente leitura, sem emitir notificações, criar grants ou recalcular SLA retroativamente. Mudança do conteúdo ou do mapeamento de um registro existente deve gerar revisão explícita, não sobrescrita silenciosa. Plano de rollback não promete desfazer leitura/download já realizado.

## Evidências exigidas

Retornar cada item como implementado, documentado, proposto ou não disponível, com commit/versão e exemplo sanitizado. Registrar responsáveis por origem, segurança, suporte e cliente sem inventar nomes. Qualificar permissões e fornecedores no ambiente permitido, sem criar serviço pago adicional ou usar a base de produção como banco descartável.

Até isso ocorrer: os módulos de C18 fornecidos aqui servem somente para testes sintéticos e inspeção privada autorizada; importação e acesso vivo permanecem desligados.
