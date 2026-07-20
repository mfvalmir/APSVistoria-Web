import { api } from "./client";

export interface Servico {
  idServico: number;
  DescricaoServico: string;
  ValorServico: number;
  Situacao: string;
}

export interface DadosServico {
  descricaoServico: string;
  valorServico: number | null;
}

export interface EdicaoServico extends DadosServico {
  situacao: "A" | "I";
}

export async function listarServicos(busca?: string, status?: "A" | "I"): Promise<Servico[]> {
  const { data } = await api.get<Servico[]>("/servico", { params: { busca, status } });
  return data;
}

export async function obterServico(id: number): Promise<Servico> {
  const { data } = await api.get<Servico>(`/servico/${id}`);
  return data;
}

export async function criarServico(dados: DadosServico): Promise<{ idServico: number }> {
  const { data } = await api.post<{ idServico: number }>("/servico", dados);
  return data;
}

export async function atualizarServico(id: number, dados: EdicaoServico): Promise<void> {
  await api.put(`/servico/${id}`, dados);
}

export async function desativarServico(id: number): Promise<void> {
  await api.delete(`/servico/${id}`);
}
