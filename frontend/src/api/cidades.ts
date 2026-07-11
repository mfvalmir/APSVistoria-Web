import { api } from "./client";

export interface Cidade {
  idCidade: number;
  DescricaoCidade: string;
  UF: string;
}

export interface DadosCidade {
  descricaoCidade: string;
  uf: string;
}

export async function listarCidades(busca?: string): Promise<Cidade[]> {
  const { data } = await api.get<Cidade[]>("/cidades", { params: { busca } });
  return data;
}

export async function obterCidade(id: number): Promise<Cidade> {
  const { data } = await api.get<Cidade>(`/cidades/${id}`);
  return data;
}

export async function criarCidade(dados: DadosCidade): Promise<void> {
  await api.post("/cidades", dados);
}

export async function atualizarCidade(id: number, dados: DadosCidade): Promise<void> {
  await api.put(`/cidades/${id}`, dados);
}

export async function excluirCidade(id: number): Promise<void> {
  await api.delete(`/cidades/${id}`);
}
