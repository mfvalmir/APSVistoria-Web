import jsPDF from "jspdf";

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function grupoPorExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena > 0) partes.push(CENTENAS[centena]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const dezena = Math.floor(resto / 10);
      const unidade = resto % 10;
      partes.push(unidade > 0 ? `${DEZENAS[dezena]} e ${UNIDADES[unidade]}` : DEZENAS[dezena]);
    }
  }
  return partes.join(" e ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const blocos: string[] = [];
  if (milhoes > 0) blocos.push(`${grupoPorExtenso(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`);
  if (milhares > 0) blocos.push(milhares === 1 ? "mil" : `${grupoPorExtenso(milhares)} mil`);
  if (resto > 0) blocos.push(grupoPorExtenso(resto));

  if (blocos.length === 1) return blocos[0];
  const ultimo = blocos.pop()!;
  return `${blocos.join(", ")} e ${ultimo}`;
}

// Escreve um valor monetário por extenso, no padrão usado em recibos brasileiros
// (ex: 1234.5 -> "mil, duzentos e trinta e quatro reais e cinquenta centavos").
export function valorPorExtenso(valor: number): string {
  const centavosTotais = Math.round(valor * 100);
  const inteiro = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;

  const reais = `${inteiroPorExtenso(inteiro)} ${inteiro === 1 ? "real" : "reais"}`;
  if (centavos <= 0) return reais;

  const centavosTexto = `${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  return `${reais} e ${centavosTexto}`;
}

interface LogoInfo {
  dataUrl: string;
  largura: number;
  altura: number;
}

let logoPromise: Promise<LogoInfo> | null = null;

function carregarLogo(): Promise<LogoInfo> {
  if (!logoPromise) {
    logoPromise = new Promise<LogoInfo>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas indisponível"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL("image/png"), largura: img.naturalWidth, altura: img.naturalHeight });
      };
      img.onerror = () => reject(new Error("Não foi possível carregar a logo"));
      img.src = "/images/logo-aps-vistoria.png";
    });
  }
  return logoPromise;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(valorIso: string): string {
  return new Date(`${valorIso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

// Aceita o documento com ou sem máscara (o chamador pode vir de fontes diferentes) e devolve
// sempre formatado: 000.000.000-00 para CPF (11 dígitos) ou 00.000.000/0000-00 para CNPJ
// (14 dígitos). Fora desses tamanhos, devolve como veio.
function formatarCpfCnpj(valor: string): string {
  const d = valor.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return valor;
}

export interface DadosRecibo {
  numeroRecibo: string;
  nomePagador: string;
  documentoPagador?: string | null;
  valor: number;
  dataPagamento: string;
  formaPagamento: string;
  referente: string;
  observacao?: string | null;
}

// Monta o PDF de recibo em papel A4, com a logo do sistema, valor por extenso e assinatura -
// modelo único reaproveitado por Conta a Receber e Vistoria (as duas telas em que faz sentido
// emitir comprovante de recebimento de uma parcela). Não abre o arquivo: isso fica a cargo de
// visualizarRecibo, que decide o que fazer com o documento pronto.
async function construirRecibo(dados: DadosRecibo): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margemEsquerda = 20;
  const margemDireita = 20;
  const larguraPagina = 210;
  const larguraUtil = larguraPagina - margemEsquerda - margemDireita;

  let y = 18;
  let alturaLogo = 0;

  try {
    const { dataUrl, largura, altura } = await carregarLogo();
    const larguraLogo = 40;
    alturaLogo = larguraLogo * (altura / largura);
    doc.addImage(dataUrl, "PNG", margemEsquerda, y, larguraLogo, alturaLogo);
  } catch {
    // segue sem a logo se não for possível carregar
  }

  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Recibo Nº ${dados.numeroRecibo}`, larguraPagina - margemDireita, y + 6, { align: "right" });
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, larguraPagina - margemDireita, y + 11, {
    align: "right",
  });

  y += Math.max(alturaLogo, 16) + 8;
  doc.setDrawColor(200);
  doc.line(margemEsquerda, y, larguraPagina - margemDireita, y);
  y += 12;

  doc.setTextColor(30);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO", larguraPagina / 2, y, { align: "center" });
  y += 12;

  doc.setFontSize(15);
  doc.text(`Valor: ${formatarMoeda(dados.valor)}`, larguraPagina / 2, y, { align: "center" });
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const documentoTrecho = dados.documentoPagador
    ? `, CPF/CNPJ nº ${formatarCpfCnpj(dados.documentoPagador)},`
    : ",";
  const paragrafo =
    `Recebemos de ${dados.nomePagador}${documentoTrecho} a quantia de ${formatarMoeda(dados.valor)} ` +
    `(${valorPorExtenso(dados.valor)}), referente a ${dados.referente}.`;
  const linhasParagrafo = doc.splitTextToSize(paragrafo, larguraUtil);
  doc.text(linhasParagrafo, margemEsquerda, y);
  y += linhasParagrafo.length * 6 + 8;

  doc.text(`Forma de pagamento: ${dados.formaPagamento}`, margemEsquerda, y);
  y += 7;
  doc.text(`Data do pagamento: ${formatarData(dados.dataPagamento)}`, margemEsquerda, y);
  y += 7;

  if (dados.observacao) {
    const linhasObs = doc.splitTextToSize(`Observação: ${dados.observacao}`, larguraUtil);
    doc.text(linhasObs, margemEsquerda, y);
    y += linhasObs.length * 6 + 3;
  }

  y += 10;
  doc.text("Para clareza, firmamos o presente recibo.", margemEsquerda, y);

  y += 30;
  const larguraAssinatura = 80;
  const xAssinatura = larguraPagina / 2 - larguraAssinatura / 2;
  doc.line(xAssinatura, y, xAssinatura + larguraAssinatura, y);
  y += 6;
  doc.setFontSize(10);
  doc.text("APS Vistoria", larguraPagina / 2, y, { align: "center" });

  return doc;
}

// Lançado quando não há valor pago a comprovar - parcela com ValorPago zerado (pagamento tipo
// Retorno/Cortesia, que não gera entrada de caixa) ou qualquer outro caso sem entrada real.
export class ReciboValorZeroError extends Error {
  constructor() {
    super(
      "Não é possível emitir recibo de valor R$ 0,00 — não há entrada de pagamento (pode ser um lançamento do tipo Retorno ou Cortesia)."
    );
    this.name = "ReciboValorZeroError";
  }
}

// Gera o PDF e abre em uma nova aba para visualização, sem forçar o download.
export async function visualizarRecibo(dados: DadosRecibo): Promise<void> {
  if (!dados.valor || dados.valor <= 0) {
    throw new ReciboValorZeroError();
  }
  const doc = await construirRecibo(dados);
  const url = URL.createObjectURL(doc.output("blob"));
  window.open(url, "_blank");
}
