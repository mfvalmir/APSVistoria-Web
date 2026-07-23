import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DashboardContaAberta, TipoContaDashboard } from "../api/dashboard";
import { adicionarRodapePaginas } from "./pdfPaginacao";

// Marrom da marca (--cor-marca), fixo aqui porque o PDF não tem acesso às variáveis CSS.
const COR_CABECALHO: [number, number, number] = [107, 74, 58];

// 0 = Pendente, 1 = Pago, 2 = Parcial, 3 = Cancelado (mesma convenção de ContaPagar/ContaReceber).
const LABEL_STATUS: Record<number, string> = {
  0: "Pendente",
  1: "Pago",
  2: "Parcial",
  3: "Cancelado",
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Lista simples das contas em aberto (Pendente/Parcial) de Contas a Pagar ou Contas a Receber,
// ordenadas por emissão - detalhamento por trás dos KPIs "A Pagar/A Receber em aberto".
export async function visualizarRelatorioContasAbertas(
  dados: DashboardContaAberta[],
  tipo: TipoContaDashboard
): Promise<void> {
  const tituloTipo = tipo === "pagar" ? "Contas a Pagar" : "Contas a Receber";
  const colunaContraparte = tipo === "pagar" ? "Fornecedor" : "Cliente";

  const doc = new jsPDF();
  const margemEsquerda = 14;
  const total = dados.reduce((soma, c) => soma + c.saldoDevedor, 0);

  doc.setFontSize(14);
  doc.text(`Relatório de ${tituloTipo} em Aberto`, margemEsquerda, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} - ${dados.length} conta(s), saldo total ${formatarMoeda(total)}`,
    margemEsquerda,
    21
  );

  autoTable(doc, {
    startY: 26,
    head: [[colunaContraparte, "Descrição", "Documento", "Emissão", "Status", "Saldo devedor"]],
    body: dados.map((c) => [
      c.contraparte || "-",
      c.descricao || "-",
      c.numeroDocumento || "-",
      formatarData(c.dataEmissao),
      LABEL_STATUS[c.idStatus] || "-",
      formatarMoeda(c.saldoDevedor),
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: COR_CABECALHO, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 242, 239] },
  });

  adicionarRodapePaginas(doc);
  const url = URL.createObjectURL(doc.output("blob"));
  window.open(url, "_blank");
}
