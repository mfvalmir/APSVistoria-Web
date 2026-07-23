import jsPDF from "jspdf";

// Numera as páginas no rodapé de um PDF já pronto (ex.: "Página: 2 / 3"). Chamar por último,
// depois de todo o conteúdo desenhado - páginas adicionadas depois dessa chamada ficam de fora
// da contagem.
export function adicionarRodapePaginas(doc: jsPDF): void {
  const totalPaginas = doc.getNumberOfPages();
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página: ${pagina} / ${totalPaginas}`, largura - 14, altura - 8, { align: "right" });
  }
}
