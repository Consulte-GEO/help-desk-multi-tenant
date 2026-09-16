# Whitespace em evidências brutas

`git diff --cached --check` encontrou espaços finais nas saídas brutas do Node (nomes parametrizados vazios e apresentação de asserts). Esses logs foram preservados sem edição; isso não é falha de testes nem verificação de segurança ignorada. A verificação de whitespace dos arquivos autorais, excluindo apenas `evidence/**`, passou. Os relatórios estão nos dois arquivos precommit-*-whitespace.txt.
