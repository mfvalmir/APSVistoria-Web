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

// "Retorno" e "Cortesia" são tipos usados só em Vistoria (pra quando o valor é 0, sem cobrança
// real) - não fazem sentido como forma de pagamento em Conta a Pagar/Receber, então ficam de
// fora desses dois fluxos.
export const TIPOS_RETORNO_CORTESIA = ["retorno", "cortesia"];

export function ehTipoRetornoOuCortesia(descricao: string): boolean {
  return TIPOS_RETORNO_CORTESIA.includes(descricao.trim().toLowerCase());
}

export async function listarTiposPagamentoPadrao(): Promise<TipoPagamento[]> {
  const tipos = await listarTiposPagamento();
  return tipos.filter((t) => !ehTipoRetornoOuCortesia(t.DescricaoTipoPagamento));
}

export async function obterTipoPagamento(id: number): Promise<TipoPagamento> {
  const { data } = await api.get<TipoPagamento>(`/tipo-pagamento/${id}`);
  return data;
}

export async function criarTipoPagamento(dados: DadosTipoPagamento): Promise<{ idTipoPagamento: number }> {
  const { data } = await api.post("/tipo-pagamento", dados);
  return data;
}

export async function atualizarTipoPagamento(id: number, dados: DadosTipoPagamento): Promise<void> {
  await api.put(`/tipo-pagamento/${id}`, dados);
}

export async function excluirTipoPagamento(id: number): Promise<void> {
  await api.delete(`/tipo-pagamento/${id}`);
}
