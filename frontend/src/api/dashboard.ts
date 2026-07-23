import { api } from "./client";

export interface DashboardCaixa {
  aberto: boolean;
  saldoAtual: number | null;
  dataAbertura: string | null;
}

export interface DashboardVistoriasMes {
  quantidade: number;
  faturamento: number;
}

export interface DashboardAlertaResumo {
  quantidade: number;
  valor: number;
}

export interface DashboardVencimento {
  tipo: "pagar" | "receber";
  idConta: number;
  idParcela: number;
  descricao: string;
  contraparte: string | null;
  dataVencimento: string;
  valor: number;
}

export interface DashboardFluxoCaixaDia {
  dia: string;
  entrada: number;
  saida: number;
}

export interface DashboardVistoriasPorMes {
  rotulo: string;
  quantidade: number;
  faturamento: number;
}

export interface DashboardTipoPagamento {
  tipo: string;
  quantidade: number;
  valor: number;
}

export interface DashboardRankingVistoriador {
  idVistoriador: number;
  nome: string;
  quantidade: number;
  faturamento: number;
}

export interface Dashboard {
  caixa: DashboardCaixa;
  aReceberAberto: number;
  aPagarAberto: number;
  vistoriasMes: DashboardVistoriasMes;
  alertas: {
    vencidas: { pagar: DashboardAlertaResumo; receber: DashboardAlertaResumo };
    vencendoEm7Dias: { pagar: DashboardAlertaResumo; receber: DashboardAlertaResumo };
    proximosVencimentos: DashboardVencimento[];
  };
  fluxoCaixa: DashboardFluxoCaixaDia[];
  vistoriasPorMes: DashboardVistoriasPorMes[];
  tiposPagamento: DashboardTipoPagamento[];
  rankingVistoriadores: DashboardRankingVistoriador[];
}

export async function buscarDashboard(): Promise<Dashboard> {
  const { data } = await api.get<Dashboard>("/dashboard");
  return data;
}

export interface DashboardVistoriaDetalhada {
  idVistoria: number;
  dataEmissao: string;
  placaVeiculo: string;
  valorTotalServico: number;
  nomeCliente: string | null;
  descricaoServico: string | null;
  idVistoriador: number | null;
  nomeVistoriador: string | null;
}

export async function buscarVistoriasPorVistoriadorDetalhado(): Promise<DashboardVistoriaDetalhada[]> {
  const { data } = await api.get<DashboardVistoriaDetalhada[]>("/dashboard/vistoriadores-detalhado");
  return data;
}

export interface DashboardParcelaDetalhada {
  idParcela: number;
  idConta: number;
  numeroParcela: number;
  dataVencimento: string;
  valorParcela: number;
  diasEmAtraso: number;
  descricaoConta: string | null;
  contraparte: string | null;
}

export interface DashboardParcelasAlertas {
  pagarVencidas: DashboardParcelaDetalhada[];
  receberVencidas: DashboardParcelaDetalhada[];
  pagarVencendo7Dias: DashboardParcelaDetalhada[];
  receberVencendo7Dias: DashboardParcelaDetalhada[];
}

export async function buscarParcelasAlertasDetalhado(): Promise<DashboardParcelasAlertas> {
  const { data } = await api.get<DashboardParcelasAlertas>("/dashboard/parcelas-alertas-detalhado");
  return data;
}

export type TipoContaDashboard = "pagar" | "receber";

export interface DashboardContaAberta {
  idConta: number;
  numeroDocumento: string | null;
  descricao: string;
  dataEmissao: string;
  saldoDevedor: number;
  idStatus: number;
  contraparte: string | null;
}

export async function buscarContasAbertasDetalhado(tipo: TipoContaDashboard): Promise<DashboardContaAberta[]> {
  const { data } = await api.get<DashboardContaAberta[]>("/dashboard/contas-abertas-detalhado", {
    params: { tipo },
  });
  return data;
}
