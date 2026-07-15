import { api } from "./client";

// 0 = Pendente, 1 = Pago, 2 = Parcial, 3 = Cancelado (mesma convenção da procedure legada).
export const STATUS_CONTA_PAGAR = [
  { valor: 0, label: "Pendente" },
  { valor: 1, label: "Pago" },
  { valor: 2, label: "Parcial" },
  { valor: 3, label: "Cancelado" },
] as const;

export interface ContaPagar {
  idContaPagar: number;
  NumeroDocumento: string | null;
  Descricao: string;
  idFornecedor: number | null;
  RazaoSocial: string | null;
  idCategoria: number;
  DescricaoCategoria: string;
  ValorTotal: number;
  TotalParcelas: number;
  DataPrimeiraParcela: string | null;
  IdPrimeiroTipoPagamento: number | null;
  DescricaoTipoPagamento: string | null;
  IntervaloMeses: number | null;
  IdStatusContaPagar: number;
  SaldoDevedor: number;
  DataEmissao: string;
  Observacao: string | null;
  idUsuarioEmissao: number;
  idUsuarioAlteracao: number | null;
  DataAlteracao: string | null;
}

export interface ParcelaContaPagar {
  IdContaPagarParcela: number;
  IdContaPagar: number;
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

export interface ContaPagarComParcelas extends ContaPagar {
  parcelas: ParcelaContaPagar[];
}

export interface DadosContaPagar {
  numeroDocumento?: string;
  descricao: string;
  idFornecedor?: number;
  idCategoria: number;
  valorTotal: number;
  totalParcelas: number;
  primeiroVencimento?: string;
  idPrimeiroTipoPagamento?: number;
  intervaloMeses?: number;
  idStatusContaPagar: number;
  dataEmissao: string;
  observacao?: string;
}

export interface EdicaoContaPagar extends DadosContaPagar {
  recalcularParcelas: boolean;
}

export async function listarContasPagar(busca?: string, status?: number | ""): Promise<ContaPagar[]> {
  const { data } = await api.get<ContaPagar[]>("/conta-pagar", { params: { busca, status } });
  return data;
}

export async function obterContaPagar(id: number): Promise<ContaPagarComParcelas> {
  const { data } = await api.get<ContaPagarComParcelas>(`/conta-pagar/${id}`);
  return data;
}

export async function criarContaPagar(dados: DadosContaPagar): Promise<{ idContaPagar: number }> {
  const { data } = await api.post<{ idContaPagar: number }>("/conta-pagar", dados);
  return data;
}

export async function atualizarContaPagar(id: number, dados: EdicaoContaPagar): Promise<void> {
  await api.put(`/conta-pagar/${id}`, dados);
}

export async function excluirContaPagar(id: number): Promise<void> {
  await api.delete(`/conta-pagar/${id}`);
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
  await api.post(`/conta-pagar/${idConta}/parcelas/${idParcela}/baixa`, dados);
}

export async function estornarParcela(idConta: number, idParcela: number, observacao: string): Promise<void> {
  await api.post(`/conta-pagar/${idConta}/parcelas/${idParcela}/estorno`, { observacao });
}
