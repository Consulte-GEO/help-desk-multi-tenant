# Aceite do primeiro piloto — NÃO APROVADO

**Ciclo16 / CG19.** O código modela preparado → piloto → aceito → contido. Esta entrega não identifica pessoas, contas, obras ou categorias de um piloto real e não o ativa.

## Matriz de saída

| Grupo | Evidência necessária | Situação desta rodada |
|---|---|---|
| Fonte e destino | SHA/fingerprint/config/schema/provedor/deploy reais correspondentes | PR lido, mas fonte nova somente local; sem deploy da composição |
| CI | Artefato original, digest, logs e attempt do checkout integral | Não executado para esta fonte |
| PostgreSQL17 e upgrade | ACL direta, concorrência, usuários antigos, migrations imutáveis | 31 cenários E/G e demais adapters ainda pendentes |
| Navegador | Desktop/mobile, CSP, teclado/foco, limpeza de audiência | Não homologado nesta rodada |
| Segurança | Privilégios, Auth/MFA/SSO, notas/exports, advisors triados | Advisors lidos; metadata SQL bloqueada; WARN pendente |
| Capacidade | Percentis, concorrência, vizinho ruidoso, pool/TLS/quota/custo | Nenhuma carga hosted ou meta aprovada |
| Recuperação | Banco/objetos/config/chaves/ledger/tombstones, tempos e não reenvio | Planejadores e ensaio filesystem sintético; não restore real |
| Revisão | Revisor independente e achados resolvidos | Autorrevisão somente |
| Operação | Donos, políticas, treinamento, contingência e providers | Nenhum aceite real novo |
| Jornada da coorte | SSO → obra → formulário/anexo → aprovação → retorno → resolução → entrega | Não executada com pessoas/provedores reais |

## Contratos de evidência

O envelope assinado é um contrato interno candidato, não um fornecedor escolhido ou uma API existente. A assinatura Ed25519 verifica a origem do atestado. O processo emissor precisa conferir evidência material e autorizações reais. Nenhuma chave privada ou rota de assinatura está no código de produto.

As evidências nomeiam tipo, ambiente, hash do manifesto/artefato, validade, condições e contagens quando cabíveis. Conjunto local, ausência, falha, inconclusão, cancelamento ou skip não equivalem a gate concluído. Um hash sozinho não é uma execução, nem assinatura de responsável.

O manifesto associa fonte, config/provedor, destino, políticas e coortes completas. Os dados de pessoa/conta/obra reais ficam privados; Git recebe referência sanitizada. O modelo organiza papéis de aceite em suporte/segurança/cliente, com pelo menos duas pessoas distintas — proposta conservadora a homologar, não nomes atribuídos pelo executor.

O aceite do cliente fica vinculado ao piloto/revisão/hash e horário de início, com evidência posterior da jornada. Um certificado de outra revisão, um papel administrativo ou uma flag global não aprova a coorte. A emissão dessas evidências, a política de signatários e seus provedores de custódia precisam de aprovação própria.

## Execução hospedada

Ampliar os clientes **existentes** `hosted-acceptance.ts`, `hosted-auth-acceptance.ts` e `hosted-write-acceptance.ts`, começando pelos plan modes. Não foi criado runner paralelo. O cliente read existente foi inspecionado; sua interface continua preservada. Não substituir o guarda-corpo de confirmação de origem nem ler tokens no modo de plano. Não pedir senha do IdP ao agente.

Depois de integração e aceite dos passos anteriores, executar a jornada de pessoas escolhidas e os negativos A/B/C/outrotenant/não-piloto. Guardar effects/replay/receipts atuais e provas source-bound. A carga/restore só ocorre em escopo e janela autorizados. Esta documentação não é tal autorização.
