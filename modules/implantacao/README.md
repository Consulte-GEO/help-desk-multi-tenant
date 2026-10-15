# Implantação Consulte GEO — site publicável (v06 · APP 5.23.0)

Site estático pronto para publicar (Netlify) em `setup.consultegeo.org`.

- `index.html` — telas do módulo de Implantação (Obra → … → Exportação).
- `importa.html` — modos de importação (3 cards): **Pré-análise** (nova), Pré-importação e Pós-importação (mantidas no pacote v5.22.42).
- `pre-analise.html` — **NOVA**: triagem da planilha recebida (upload → resultado), mensagem ao cliente, relatório Excel, self-test C1–C20.
- `emails/index.html` — galeria dos 10 e-mails do sistema.
- `docs/` — PK, integração da Pré-análise (INTEGRACAO-IMPORTA.md) e relatórios V05/V06.
- `exemplos/planilha-cliente-exemplo.xlsx` — planilha "suja" para demonstrar a triagem.
- `tools/run-intake-tests.js` — gate de CI (Node) da Pré-análise.

## Publicar
Netlify → New site → arraste esta pasta (ou conecte o repo, `publish = "."`). Sem build step.
