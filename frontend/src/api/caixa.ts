import { api } from "./client";

// Origem do lançamento em CaixaMovimento (convenção fixada na procedure Manter_ContaReceber /
// usada também pelos helpers de baixa/estorno em contaPagar.ts e contaReceber.ts).
export const ORIGEM_MOVIMENTO: Record<number, string> = {
  0: "Manual",
  1: "Conta a Pagar",
  2: "Conta a Receber",
  3: "Vistoria",
};

export interface Caixa {
  idCaixa: number;
  DataAbertura: string;
  SaldoInicial: number;
  idUsuarioAbertura: number;
  NomeUsuarioAbertura: string | null;
  DataFechamento: string | null;
  SaldoFinal: number | null;
  idUsuarioFechamento: number | null;
  NomeUsuarioFechamento: string | null;
  Observacao: string | null;
}

export interface MovimentoCaixa {
  idMovimento: number;
  idCaixa: number;
  DataHora: string;
  TipoMovimento: "E" | "S";
  idFormaPagamento: number;
  DescricaoTipoPagamento: string | null;
  Valor: number;
  TipoOrigem: number;
  idOrigem: number | null;
  Descricao: string | null;
  idusuario: number | null;
}

export interface CaixaComMovimentos extends Caixa {
  movimentos: MovimentoCaixa[];
}

export interface DadosCaixa {
  dataAbertura: string;
  saldoInicial: number;
  observacao?: string;
}

export async function listarCaixas(
  busca?: string,
  status?: "aberto" | "fechado" | "todos",
  dataInicial?: string,
  dataFinal?: string
): Promise<Caixa[]> {
  const { data } = await api.get<Caixa[]>("/caixa", { params: { busca, status, dataInicial, dataFinal } });
  return data;
}

export async function obterCaixa(id: number): Promise<CaixaComMovimentos> {
  const { data } = await api.get<CaixaComMovimentos>(`/caixa/${id}`);
  return data;
}

export async function abrirCaixa(dados: DadosCaixa): Promise<{ idCaixa: number }> {
  const { data } = await api.post<{ idCaixa: number }>("/caixa", dados);
  return data;
}

export async function atualizarCaixa(id: number, dados: DadosCaixa): Promise<void> {
  await api.put(`/caixa/${id}`, dados);
}

export async function excluirCaixa(id: number): Promise<void> {
  await api.delete(`/caixa/${id}`);
}

export async function fecharCaixa(id: number, saldoFinal: number, observacao?: string): Promise<void> {
  await api.post(`/caixa/${id}/fechar`, { saldoFinal, observacao });
}
