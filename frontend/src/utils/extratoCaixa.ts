import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Caixa, MovimentoCaixa, ORIGEM_MOVIMENTO } from "../api/caixa";
import { adicionarRodapePaginas } from "./pdfPaginacao";

// Mesma cor de marca usada em exportarPdf.ts (o PDF não tem acesso às variáveis CSS).
const COR_CABECALHO: [number, number, number] = [107, 74, 58];
const COR_RODAPE: [number, number, number] = [230, 225, 220];

function pad6(valor: number): string {
  return String(valor).padStart(6, "0");
}

function formatarValor(valor: number | null): string {
  if (valor === null) return "-";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(valor: string | null): string {
  if (!valor) return "-";
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

// Extrato de um único caixa (cabeçalho + movimentos), diferente da exportação genérica da
// listagem (que só lista os cabeçalhos de vários caixas, sem itens).
export function gerarExtratoCaixa(caixa: Caixa, movimentos: MovimentoCaixa[]): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const aberto = !caixa.DataFechamento;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`Extrato do Caixa nº ${pad6(caixa.idCaixa)}`, 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 21);

  doc.setFontSize(10);
  doc.setTextColor(0);
  const linhasCabecalho = [
    `Abertura: ${formatarData(caixa.DataAbertura)}    Fechamento: ${formatarData(caixa.DataFechamento)}    ` +
      `Status: ${aberto ? "ABERTO" : "FECHADO"}`,
    `Saldo Inicial: ${formatarValor(caixa.SaldoInicial)}    Saldo Final: ${formatarValor(caixa.SaldoFinal)}`,
    `Funcionário Abertura: ${caixa.NomeUsuarioAbertura || "-"}    ` +
      `Funcionário Fechamento: ${caixa.NomeUsuarioFechamento || "-"}`,
  ];
  if (caixa.Observacao) {
    const linhasObservacao = caixa.Observacao.split("\n");
    linhasCabecalho.push(`Observações: ${linhasObservacao[0]}`);
    for (const linha of linhasObservacao.slice(1)) {
      linhasCabecalho.push(`             ${linha}`);
    }
  }
  doc.text(linhasCabecalho, 14, 29);

  const totalEntradas = movimentos.filter((m) => m.TipoMovimento === "E").reduce((soma, m) => soma + m.Valor, 0);
  const totalSaidas = movimentos.filter((m) => m.TipoMovimento === "S").reduce((soma, m) => soma + m.Valor, 0);

  autoTable(doc, {
    startY: 29 + linhasCabecalho.length * 5 + 4,
    head: [["Mov. Nº", "Tipo", "Data/Hora", "Tipo Pgto.", "Valor", "Código", "Origem", "Descrição", "Usuário"]],
    body: movimentos.map((m) => [
      pad6(m.idMovimento),
      m.TipoMovimento === "E" ? "Entrada" : "Saída",
      formatarDataHora(m.DataHora),
      m.DescricaoTipoPagamento || "-",
      formatarValor(m.Valor),
      m.idOrigem !== null ? pad6(m.idOrigem) : "-",
      ORIGEM_MOVIMENTO[m.TipoOrigem] || "-",
      m.Descricao || "-",
      m.idusuario !== null ? pad6(m.idusuario) : "-",
    ]),
    foot: [
      ["", "", "", "", "", "", "", "Total Entradas", formatarValor(totalEntradas)],
      ["", "", "", "", "", "", "", "Total Saídas", formatarValor(totalSaidas)],
    ],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: COR_CABECALHO, textColor: 255 },
    footStyles: { fillColor: COR_RODAPE, textColor: 0, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 242, 239] },
  });

  adicionarRodapePaginas(doc);
  doc.save(`caixa-${pad6(caixa.idCaixa)}-extrato.pdf`);
}
