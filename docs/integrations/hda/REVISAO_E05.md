# Autorrevisão E05

Revisão separada do autor, sem ferramenta de subagentes/revisor independente. Escopo: quatro módulos novos, fixtures e testes de composição. O core e o candidato SQL não foram alterados.

## Achado importante corrigido

O owner inicial fixava identidade e condição de habilitação, mas não consumia a validade observada no banco durante uma espera do callback. A validação dos horários no recibo não bastava: um recibo podia ser coerente no momento da gravação e vencer antes do COMMIT.

A suíte `registration-transaction-expiry.test.ts` demonstrou quatro falhas: leitura atrasada, atraso de entrega da observação de escopo e conclusão/falha preparadas antes do vencimento da reserva. `13-red-expiry-review.tap` tem quatro falhas e um positivo preservado. O positivo verifica que ler um recibo histórico não concede nem exige renovar sua reserva antiga.

Correção: orçamento monotônico conservador derivado dos horários nativos, com início antes de consultar; checagem nas fronteiras e antes de COMMIT pelo core. Após correção, `14-green-expiry-review.tap` tem 5/5 e `15-cumulative-reviewed.tap` tem 407/407. Nenhuma guarda SQL foi removida. O teste de desativação depois do despacho de COMMIT preserva sua confirmação real.

## Outros pontos conferidos

Escopo inteiro fixado; não avaliar getters; finalidade de recibo; distinção ausência/erro; sanitize de error/cause; proteção de promessas completas do store e de rejeição engolida; leitura sem relançamento; perda de ACK simulada depois do efeito; modelo fora da transação; pool de propriedade externa; acesso tardio ao store; separação das flags de execução/observação.

## Decisões e limites

Continuou-se a composição explicitamente prevista na E04 porque clone/PG/driver permaneceram indisponíveis. Custo/limite: não há aceite integral/nativo nem promoção; HDA-02 continua parcial.

Consulta de recibos de análise usa o mesmo propósito autorizado do comando original. Não se criou autorização administrativa para driblar revogação ou estados do chamado. Custo/limite: certas recuperações após encerramento continuarão recusadas até haver um fluxo próprio qualificado.

A revisão do comportamento PostgreSQL/locks/deferred triggers foi limitada à leitura; não é homologação. Confinamento do host/CLI e APIs reais não foram exercitados. Não foram identificados ajustes cosméticos pendentes no recorte, mas isso não substitui revisão independente.
