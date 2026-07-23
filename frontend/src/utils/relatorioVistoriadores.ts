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

// Agrupa as vistorias por vistoriador (mantendo, dentro do grupo, a ordem em que vieram do
// backend - já cronológica) e monta um PDF com uma tabela por grupo, ordenado do vistoriador
// com mais vistorias pro com menos. É a visão detalhada que complementa o ranking do
// dashboard (que só mostra os totais agregados).
export async function visualizarRelatorioVistoriadores(
  dados: DashboardVistoriaDetalhada[],
  referenciaMes: string
): Promise<void> {
  const grupos = new Map<string, DashboardVistoriaDetalhada[]>();
  for (const v of dados) {
    const chave = v.nomeVistoriador || "Sem vistoriador definido";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(v);
  }
  const nomesOrdenados = [...grupos.keys()].sort(
    (a, b) => (grupos.get(b)?.length || 0) - (grupos.get(a)?.length || 0)
  );

  const doc = new jsPDF({ orientation: "landscape" });
  const margemEsquerda = 14;
  const alturaPagina = doc.internal.pageSize.getHeight();

  doc.setFontSize(14);
  doc.text(`Relatório de Vistorias por Vistoriador — ${referenciaMes}`, margemEsquerda, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} - ${dados.length} vistoria(s), ${nomesOrdenados.length} vistoriador(es)`,
    margemEsquerda,
    21
  );

  let y = 28;

  for (const nome of nomesOrdenados) {
    const vistoriasDoGrupo = grupos.get(nome)!;
    const faturamentoGrupo = vistoriasDoGrupo.reduce((soma, v) => soma + v.valorTotalServico, 0);

    if (y > alturaPagina - 40) {
      doc.addPage();
      y = 18;
    }

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text(nome, margemEsquerda, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`${vistoriasDoGrupo.length} vistoria(s) — ${formatarMoeda(faturamentoGrupo)}`, margemEsquerda, y + 5);
    y += 9;

    autoTable(doc, {
      startY: y,
      margin: { left: margemEsquerda },
      head: [["Nº", "Data", "Placa", "Cliente", "Serviço", "Valor"]],
      body: vistoriasDoGrupo.map((v) => [
        String(v.idVistoria),
        formatarData(v.dataEmissao),
        v.placaVeiculo,
        v.nomeCliente || "-",
        v.descricaoServico || "-",
        formatarMoeda(v.valorTotalServico),
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
