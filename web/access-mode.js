// Acesso simples: e-mail e senha; código MFA quando exigido pelo provedor.
// Nenhum parâmetro de URL altera isto.
export const ADVANCED_ACCESS = false;

// Reativação futura, após revisão dos fluxos correspondentes:
// export const ADVANCED_ACCESS = true;
// Workspace manual, recuperação, senha e gestão ampliada ficam desativados na UI.
// Consulta e primeiro autenticador da própria conta têm acesso independente.
// Os módulos e testes anteriores permanecem preservados.
