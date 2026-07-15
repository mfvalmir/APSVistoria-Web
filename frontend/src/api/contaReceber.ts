import { api } from "./client";

// 0 = Pendente, 1 = Pago, 2 = Parcial, 3 = Cancelado (mesma convenção da procedure legada).
export const STATUS_CONTA_RECEBER = [
  { valor: 0, label: "Pendente" },
  { valor: 1, label: "Pago" },
  { valor: 2, label: "Parcial" },
  { valor: 3, label: "Cancelado" },
] as const;

export interface ContaReceber {
  IdContaReceber: number;
  NumeroDocumento: string | null;
  Descricao: string;
  idCliente: number | null;
  NomeCliente: string | null;
  idCategoria: number;
  DescricaoCategoria: string;
  ValorTotal: number;
  TotalParcelas: number;
  DataPrimeiraParcela: string | null;
  IdPrimeiroTipoPagamento: number | null;
  DescricaoTipoPagamento: string | null;
  IntervaloMeses: number | null;
  IdStatusContaReceber: number;
  SaldoDevedor: number;
  DataEmissao: string;
  Observacao: string | null;
  idUsuarioEmissao: number;
  idUsuarioAlteracao: number | null;
  DataAlteracao: string | null;
}

export interface ParcelaContaReceber {
  IdContaReceberParcela: number;
  IdContaReceber: number;
  NumeroParcela: number;
  ValorParcela: number;
  ValorDesconto: number;
  ValorJuros: number;
  ValorMulta: number;
  ValorPago: number;
  DataVencimento: string;
  DataPagamento: string | null;
  IdStatusParcela: number;
  IdTipoPagamento: number | null;
  DescricaoTipoPagamento: string | null;
  Observacao: string | null;
}

export interface ContaReceberComParcelas extends ContaReceber {
  parcelas: ParcelaContaReceber[];
}

export interface DadosContaReceber {
  numeroDocumento?: string;
  descricao: string;
  idCliente?: number;
  idCategoria: number;
  valorTotal: number;
  totalParcelas: number;
  primeiroVencimento?: string;
  idPrimeiroTipoPagamento?: number;
  intervaloMeses?: number;
  idStatusContaReceber: number;
  dataEmissao: string;
  observacao?: string;
}

export interface EdicaoContaReceber extends DadosContaReceber {
  recalcularParcelas: boolean;
}

export async function listarContasReceber(busca?: string, status?: number | ""): Promise<ContaReceber[]> {
  const { data } = await api.get<ContaReceber[]>("/conta-receber", { params: { busca, status } });
  return data;
}

export async function obterContaReceber(id: number): Promise<ContaReceberComParcelas> {
  const { data } = await api.get<ContaReceberComParcelas>(`/conta-receber/${id}`);
  return data;
}

export async function criarContaReceber(dados: DadosContaReceber): Promise<{ idContaReceber: number }> {
  const { data } = await api.post<{ idContaReceber: number }>("/conta-receber", dados);
  return data;
}

export async function atualizarContaReceber(id: number, dados: EdicaoContaReceber): Promise<void> {
  await api.put(`/conta-receber/${id}`, dados);
}

export async function excluirContaReceber(id: number): Promise<void> {
  await api.delete(`/conta-receber/${id}`);
}

export interface DadosBaixaParcela {
  dataPagamento: string;
  valorDesconto?: number;
  valorJuros?: number;
  valorMulta?: number;
  idTipoPagamento?: number;
}

export async function baixarParcela(
  idConta: number,
  idParcela: number,
  dados: DadosBaixaParcela
): Promise<void> {
  await api.post(`/conta-receber/${idConta}/parcelas/${idParcela}/baixa`, dados);
}

export async function estornarParcela(idConta: number, idParcela: number, observacao: string): Promise<void> {
  await api.post(`/conta-receber/${idConta}/parcelas/${idParcela}/estorno`, { observacao });
}
