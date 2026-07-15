import { api } from "./client";

export interface TipoPagamento {
  idTipoPagamento: number;
  DescricaoTipoPagamento: string;
}

export interface DadosTipoPagamento {
  descricaoTipoPagamento: string;
}

export async function listarTiposPagamento(busca?: string): Promise<TipoPagamento[]> {
  const { data } = await api.get<TipoPagamento[]>("/tipo-pagamento", { params: { busca } });
  return data;
}

// "Retorno" e "Cortesia" são tipos usados só em Vistoria - não fazem sentido como forma de
// pagamento em Conta a Pagar/Receber, então ficam de fora desses dois fluxos.
const TIPOS_OCULTOS_EM_CONTA_PAGAR_RECEBER = ["retorno", "cortesia"];

export async function listarTiposPagamentoPadrao(): Promise<TipoPagamento[]> {
  const tipos = await listarTiposPagamento();
  return tipos.filter(
    (t) => !TIPOS_OCULTOS_EM_CONTA_PAGAR_RECEBER.includes(t.DescricaoTipoPagamento.trim().toLowerCase())
  );
}

export async function obterTipoPagamento(id: number): Promise<TipoPagamento> {
  const { data } = await api.get<TipoPagamento>(`/tipo-pagamento/${id}`);
  return data;
}

export async function criarTipoPagamento(dados: DadosTipoPagamento): Promise<void> {
  await api.post("/tipo-pagamento", dados);
}

export async function atualizarTipoPagamento(id: number, dados: DadosTipoPagamento): Promise<void> {
  await api.put(`/tipo-pagamento/${id}`, dados);
}

export async function excluirTipoPagamento(id: number): Promise<void> {
  await api.delete(`/tipo-pagamento/${id}`);
}
