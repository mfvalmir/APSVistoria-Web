import { api } from "./client";

export interface Categoria {
  IdCategoria: number;
  DescricaoCategoria: string;
}

export interface DadosCategoria {
  descricaoCategoria: string;
}

export async function listarCategorias(busca?: string): Promise<Categoria[]> {
  const { data } = await api.get<Categoria[]>("/categoria", { params: { busca } });
  return data;
}

export async function obterCategoria(id: number): Promise<Categoria> {
  const { data } = await api.get<Categoria>(`/categoria/${id}`);
  return data;
}

export async function criarCategoria(dados: DadosCategoria): Promise<{ IdCategoria: number }> {
  const { data } = await api.post("/categoria", dados);
  return data;
}

export async function atualizarCategoria(id: number, dados: DadosCategoria): Promise<void> {
  await api.put(`/categoria/${id}`, dados);
}

export async function excluirCategoria(id: number): Promise<void> {
  await api.delete(`/categoria/${id}`);
}
