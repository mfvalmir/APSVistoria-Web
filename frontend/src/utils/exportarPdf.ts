import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ColunaExportacao } from "./exportarCsv";

// Marrom da marca (--cor-marca), fixo aqui porque o PDF não tem acesso às variáveis CSS.
const COR_CABECALHO: [number, number, number] = [107, 74, 58];

export function exportarPdf<T>(nomeArquivo: string, titulo: string, dados: T[], colunas: ColunaExportacao<T>[]): void {
  const doc = new jsPDF({ orientation: colunas.length > 5 ? "landscape" : "portrait" });

  doc.setFontSize(14);
  doc.text(titulo, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} - ${dados.length} registro(s)`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [colunas.map((c) => c.cabecalho)],
    body: dados.map((item) => colunas.map((c) => c.valor(item))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: COR_CABECALHO, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 242, 239] },
  });

  doc.save(`${nomeArquivo}.pdf`);
}
