import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DashboardParcelaDetalhada, DashboardParcelasAlertas } from "../api/dashboard";
import { adicionarRodapePaginas } from "./pdfPaginacao";

// Marrom da marca (--cor-marca), fixo aqui porque o PDF não tem acesso às variáveis CSS.
const COR_CABECALHO: [number, number, number] = [107, 74, 58];

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

interface SecaoRelatorio {
  titulo: string;
  colunaContraparte: string;
  colunaDias: string;
  dados: DashboardParcelaDetalhada[];
  // "vencendo": diasEmAtraso vem negativo do backend (data futura) - inverte pra exibir como
  // número positivo de dias até o vencimento.
  vencendo: boolean;
}

// Um único PDF com uma seção por categoria de alerta (Pagar/Receber x Vencidas/Vencendo em 7
// dias) - categorias sem nenhuma parcela são puladas, só entra no relatório o que tem conteúdo.
export async function visualizarRelatorioParcelasAlertas(dados: DashboardParcelasAlertas): Promise<void> {
  const secoes: SecaoRelatorio[] = [
    {
      titulo: "Contas a Pagar — Vencidas",
      colunaContraparte: "Fornecedor",
      colunaDias: "Dias em atraso",
      dados: dados.pagarVencidas,
      vencendo: false,
    },
    {
      titulo: "Contas a Receber — Vencidas",
      colunaContraparte: "Cliente",
      colunaDias: "Dias em atraso",
      dados: dados.receberVencidas,
      vencendo: false,
    },
    {
      titulo: "Contas a Pagar — Vencendo em 7 dias",
      colunaContraparte: "Fornecedor",
      colunaDias: "Dias para vencer",
      dados: dados.pagarVencendo7Dias,
      vencendo: true,
    },
    {
      titulo: "Contas a Receber — Vencendo em 7 dias",
      colunaContraparte: "Cliente",
      colunaDias: "Dias para vencer",
      dados: dados.receberVencendo7Dias,
      vencendo: true,
    },
  ].filter((secao) => secao.dados.length > 0);

  const doc = new jsPDF();
  const margemEsquerda = 14;
  const alturaPagina = doc.internal.pageSize.getHeight();
  const totalParcelas = secoes.reduce((soma, s) => soma + s.dados.length, 0);

  doc.setFontSize(14);
  doc.text("Relatório de Parcelas em Aberto", margemEsquerda, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} - ${totalParcelas} parcela(s)`, margemEsquerda, 21);

  let y = 28;

  for (const secao of secoes) {
    const totalSecao = secao.dados.reduce((soma, p) => soma + p.valorParcela, 0);

    if (y > alturaPagina - 40) {
      doc.addPage();
      y = 18;
    }

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text(secao.titulo, margemEsquerda, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`${secao.dados.length} parcela(s) — ${formatarMoeda(totalSecao)}`, margemEsquerda, y + 5);
    y += 9;

    autoTable(doc, {
      startY: y,
      margin: { left: margemEsquerda },
      head: [[secao.colunaContraparte, "Descrição", "Parcela", "Vencimento", secao.colunaDias, "Valor"]],
      body: secao.dados.map((p) => [
        p.contraparte || "-",
        p.descricaoConta || "-",
        String(p.numeroParcela),
        formatarData(p.dataVencimento),
        String(secao.vencendo ? -p.diasEmAtraso : p.diasEmAtraso),
        formatarMoeda(p.valorParcela),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: COR_CABECALHO, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 242, 239] },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  adicionarRodapePaginas(doc);
  const url = URL.createObjectURL(doc.output("blob"));
  window.open(url, "_blank");
}
