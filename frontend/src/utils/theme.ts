export type Tema = "light" | "dark";

const CHAVE_ARMAZENAMENTO = "tema";

export function obterTemaInicial(): Tema {
  const salvo = localStorage.getItem(CHAVE_ARMAZENAMENTO);
  if (salvo === "light" || salvo === "dark") return salvo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem(CHAVE_ARMAZENAMENTO, tema);
}
