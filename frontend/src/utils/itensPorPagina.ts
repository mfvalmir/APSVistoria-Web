const PREFIXO = "itens-por-pagina-";
const PADRAO = 15;

export function obterItensPorPagina(pagina: string): number {
  try {
    const salvo = localStorage.getItem(PREFIXO + pagina);
    if (salvo) {
      const valor = Number(salvo);
      if (!Number.isNaN(valor) && valor > 0) return valor;
    }
  } catch {
    // ignora e cai no padrão
  }
  return PADRAO;
}

export function salvarItensPorPagina(pagina: string, valor: number): void {
  localStorage.setItem(PREFIXO + pagina, String(valor));
}
