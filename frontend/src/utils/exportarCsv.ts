export interface ColunaExportacao<T> {
  cabecalho: string;
  valor: (item: T) => string;
}

function escaparCampoCsv(valor: string): string {
  if (/[;"\n\r]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

// Ponto-e-vírgula como separador (não vírgula): é o padrão que o Excel em pt-BR espera, já que a
// vírgula é o separador decimal nessa localidade. BOM no início garante que acentos abram certo.
export function exportarCsv<T>(nomeArquivo: string, dados: T[], colunas: ColunaExportacao<T>[]): void {
  const linhas = [
    colunas.map((c) => escaparCampoCsv(c.cabecalho)).join(";"),
    ...dados.map((item) => colunas.map((c) => escaparCampoCsv(c.valor(item))).join(";")),
  ];
  const conteudo = "﻿" + linhas.join("\r\n");
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Monta as colunas de exportação a partir da mesma definição de colunas visíveis da tabela
// (chave + label), reaproveitando um mapa de extratores por chave em vez de duplicar a lista.
export function colunasVisiveisParaExportacao<T>(
  colunas: { chave: string; label: string }[],
  colunasVisiveis: Set<string>,
  extratores: Record<string, (item: T) => string>
): ColunaExportacao<T>[] {
  return colunas
    .filter((c) => colunasVisiveis.has(c.chave) && extratores[c.chave])
    .map((c) => ({ cabecalho: c.label, valor: extratores[c.chave] }));
}
