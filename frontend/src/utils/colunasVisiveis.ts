const PREFIXO = "colunas-visiveis-";

export function obterColunasVisiveis(pagina: string, colunasPadrao: string[]): Set<string> {
  try {
    const salvo = localStorage.getItem(PREFIXO + pagina);
    if (salvo) return new Set(JSON.parse(salvo));
  } catch {
    // ignora e cai no padrão
  }
  return new Set(colunasPadrao);
}

export function salvarColunasVisiveis(pagina: string, colunas: Set<string>): void {
  localStorage.setItem(PREFIXO + pagina, JSON.stringify(Array.from(colunas)));
}
