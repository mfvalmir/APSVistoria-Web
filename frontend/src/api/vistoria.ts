import { api } from "./client";
import { ParcelaContaReceber } from "./contaReceber";

// 0 = Pendente, 1 = Pago, 2 = Parcial, 3 = Cancelado (mesma convenção da StatusTitulo).
export const STATUS_VISTORIA = [
  { valor: 0, label: "Pendente" },
  { valor: 1, label: "Pago" },
  { valor: 2, label: "Parcial" },
  { valor: 3, label: "Cancelado" },
] as const;

export interface Vistoria {
  idVistoria: number;
  DataEmissao: string;
  PlacaVeiculo: string;
  idCliente: number;
  NomeCliente: string | null;
  CpfCnpj: string | null;
  idResponsavel: number | null;
  NomeResponsavel: string | null;
  idVistoriador: number | null;
  NomeVistoriador: string | null;
  idServico: number;
  DescricaoServico: string | null;
  ValorUnitarioServico: number;
  QuantidadeServico: number;
  ValorTotalServico: number;
  TotalParcelas: number;
  DataPrimeiraParcela: string | null;
  idPrimeiroTipoPagamento: number | null;
  DescricaoTipoPagamento: string | null;
  idStatusVistoria: number;
  SaldoDevedor: number | null;
  idContaReceber: number | null;
  Observacao: string | null;
  idUsuarioEmissao: number;
  idUsuarioAlteracao: number | null;
  DataAlteracao: string | null;
}

// Parcelas de Vistoria são as próprias ContaReceberParcela geradas pela Manter_Vistoria -
// reaproveita o mesmo tipo, sem duplicar.
export interface VistoriaComParcelas extends Vistoria {
  parcelas: ParcelaContaReceber[];
}

export interface DadosVistoria {
  dataEmissao: string;
  placaVeiculo: string;
  idCliente: number;
  idResponsavel?: number;
  idVistoriador?: number;
  idServico: number;
  valorUnitarioServico?: number;
  quantidadeServico?: number;
  valorTotalServico: number;
  totalParcelas: number;
  dataPrimeiraParcela?: string;
  idPrimeiroTipoPagamento?: number;
  idStatusVistoria?: number;
  observacao?: string;
}

export async function listarVistorias(busca?: string, status?: number | ""): Promise<Vistoria[]> {
  const { data } = await api.get<Vistoria[]>("/vistoria", { params: { busca, status } });
  return data;
}

export async function obterVistoria(id: number): Promise<VistoriaComParcelas> {
  const { data } = await api.get<VistoriaComParcelas>(`/vistoria/${id}`);
  return data;
}

export async function criarVistoria(dados: DadosVistoria): Promise<{ idVistoria: number }> {
  const { data } = await api.post<{ idVistoria: number }>("/vistoria", dados);
  return data;
}

export async function atualizarVistoria(id: number, dados: DadosVistoria): Promise<void> {
  await api.put(`/vistoria/${id}`, dados);
}

export async function excluirVistoria(id: number): Promise<void> {
  await api.delete(`/vistoria/${id}`);
}
