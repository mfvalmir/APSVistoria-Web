import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DashboardVistoriaDetalhada } from "../api/dashboard";
import { adicionarRodapePaginas } from "./pdfPaginacao";

// Marrom da marca (--cor-marca), fixo aqui porque o PDF não tem acesso às variáveis CSS.
const COR_CABECALHO: [number, number, number] = [107, 74, 58];

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Lista simples (sem agrupamento) das vistorias do mês, em ordem cronológica - detalhamento
// por trás do KPI "Vistorias no mês". Complementa o relatório agrupado por vistoriador do
// card de ranking, que já usa a mesma fonte de dados.
export async function visualizarRelatorioVistoriasMes(
  dados: DashboardVistoriaDetalhada[],
  referenciaMes: string
): Promise<void> {
  const ordenado = [...dados].sort((a, b) => a.dataEmissao.localeCompare(b.dataEmissao));
  const total = ordenado.reduce((soma, v) => soma + v.valorTotalServico, 0);

  const doc = new jsPDF({ orientation: "landscape" });
  const margemEsquerda = 14;

  doc.setFontSize(14);
  doc.text(`Relatório de Vistorias do Mês — ${referenciaMes}`, margemEsquerda, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} - ${ordenado.length} vistoria(s), total ${formatarMoeda(total)}`,
    margemEsquerda,
    21
  );

  autoTable(doc, {
    startY: 26,
    head: [["Nº", "Data", "Placa", "Cliente", "Vistoriador", "Serviço", "Valor"]],
    body: ordenado.map((v) => [
      String(v.idVistoria),
      formatarData(v.dataEmissao),
      v.placaVeiculo,
      v.nomeCliente || "-",
      v.nomeVistoriador || "-",
      v.descricaoServico || "-",
      formatarMoeda(v.valorTotalServico),
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: COR_CABECALHO, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 242, 239] },
  });

  adicionarRodapePaginas(doc);
  const url = URL.createObjectURL(doc.output("blob"));
  window.open(url, "_blank");
}
