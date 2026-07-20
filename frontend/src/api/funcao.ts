import { api } from "./client";

export interface Funcao {
  idFuncao: number;
  descricao: string;
}

export interface DadosFuncao {
  descricao: string;
}

export async function listarFuncoes(busca?: string): Promise<Funcao[]> {
  const { data } = await api.get<Funcao[]>("/funcao", { params: { busca } });
  return data;
}

export async function obterFuncao(id: number): Promise<Funcao> {
  const { data } = await api.get<Funcao>(`/funcao/${id}`);
  return data;
}

export async function criarFuncao(dados: DadosFuncao): Promise<{ idFuncao: number }> {
  const { data } = await api.post("/funcao", dados);
  return data;
}

export async function atualizarFuncao(id: number, dados: DadosFuncao): Promise<void> {
  await api.put(`/funcao/${id}`, dados);
}

export async function excluirFuncao(id: number): Promise<void> {
  await api.delete(`/funcao/${id}`);
}
