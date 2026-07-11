import { api } from "./client";

export interface Bairro {
  IDBairro: number;
  DescricaoBairro: string;
  idCidade: number;
  DescricaoCidade: string | null;
  UF: string | null;
}

export interface DadosBairro {
  descricaoBairro: string;
  idCidade: number;
}

export async function listarBairros(busca?: string): Promise<Bairro[]> {
  const { data } = await api.get<Bairro[]>("/bairros", { params: { busca } });
  return data;
}

export async function obterBairro(id: number): Promise<Bairro> {
  const { data } = await api.get<Bairro>(`/bairros/${id}`);
  return data;
}

export async function criarBairro(dados: DadosBairro): Promise<void> {
  await api.post("/bairros", dados);
}

export async function atualizarBairro(id: number, dados: DadosBairro): Promise<void> {
  await api.put(`/bairros/${id}`, dados);
}

export async function excluirBairro(id: number): Promise<void> {
  await api.delete(`/bairros/${id}`);
}
