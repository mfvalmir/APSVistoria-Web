import { useState } from "react";

export type DirecaoOrdenacao = "asc" | "desc";

export interface EstadoOrdenacao {
  campo: string | null;
  direcao: DirecaoOrdenacao;
}

// Ciclo ao clicar num cabeçalho: asc -> desc -> volta pra ordem original (sem campo).
export function useOrdenacao(campoInicial: string | null = null, direcaoInicial: DirecaoOrdenacao = "asc") {
  const [ordenacao, setOrdenacao] = useState<EstadoOrdenacao>({ campo: campoInicial, direcao: direcaoInicial });

  function alternarOrdenacao(campo: string) {
    setOrdenacao((atual) => {
      if (atual.campo !== campo) return { campo, direcao: "asc" };
      if (atual.direcao === "asc") return { campo, direcao: "desc" };
      return { campo: null, direcao: "asc" };
    });
  }

  return { ordenacao, alternarOrdenacao };
}

type Extrator<T> = (item: T) => string | number | null | undefined;

export function ordenarLista<T>(
  lista: T[],
  ordenacao: EstadoOrdenacao,
  extratores: Record<string, Extrator<T>>
): T[] {
  if (!ordenacao.campo) return lista;
  const extrair = extratores[ordenacao.campo];
  if (!extrair) return lista;

  const copia = [...lista];
  copia.sort((a, b) => {
    const va = extrair(a);
    const vb = extrair(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;

    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base", numeric: true });

    return ordenacao.direcao === "asc" ? cmp : -cmp;
  });
  return copia;
}
