import { api } from "./client";

export interface Responsavel {
  idResponsavel: number;
  idCliente: number;
  NomeResponsavel: string;
  DocResponsavel: string | null;
  CelularResponsavel: string | null;
}

export interface DadosResponsavel {
  nomeResponsavel: string;
  docResponsavel?: string;
  celularResponsavel?: string;
}

export async function listarResponsaveis(clienteId: number): Promise<Responsavel[]> {
  const { data } = await api.get<Responsavel[]>(`/clientes/${clienteId}/responsaveis`);
  return data;
}

export async function criarResponsavel(clienteId: number, dados: DadosResponsavel): Promise<void> {
  await api.post(`/clientes/${clienteId}/responsaveis`, dados);
}

export async function atualizarResponsavel(
  clienteId: number,
  id: number,
  dados: DadosResponsavel
): Promise<void> {
  await api.put(`/clientes/${clienteId}/responsaveis/${id}`, dados);
}

export async function excluirResponsavel(clienteId: number, id: number): Promise<void> {
  await api.delete(`/clientes/${clienteId}/responsaveis/${id}`);
}
