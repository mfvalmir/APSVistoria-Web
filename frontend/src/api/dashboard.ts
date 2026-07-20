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

export interface Dashboard {
  caixa: DashboardCaixa;
  aReceberAberto: number;
  aPagarAberto: number;
  vistoriasMes: DashboardVistoriasMes;
  alertas: {
    vencidas: DashboardAlertaResumo;
    vencendoEm7Dias: DashboardAlertaResumo;
    proximosVencimentos: DashboardVencimento[];
  };
  fluxoCaixa: DashboardFluxoCaixaDia[];
  vistoriasPorMes: DashboardVistoriasPorMes[];
  tiposPagamento: DashboardTipoPagamento[];
}

export async function buscarDashboard(): Promise<Dashboard> {
  const { data } = await api.get<Dashboard>("/dashboard");
  return data;
}
