import { api } from "./client";

export interface Cliente {
  idCliente: number;
  NomeCliente: string;
  TipoPessoa: "F" | "J";
  CpfCnpj: string;
  TipoCliente: string;
  Observacao: string | null;
}

export interface DadosCliente {
  nomeCliente: string;
  tipoPessoa: "F" | "J";
  cpfCnpj: string;
  tipoCliente?: string;
  observacao?: string;
}

export async function listarClientes(busca?: string, tipoPessoa?: "F" | "J"): Promise<Cliente[]> {
  const { data } = await api.get<Cliente[]>("/clientes", { params: { busca, tipoPessoa } });
  return data;
}

export async function obterCliente(id: number): Promise<Cliente> {
  const { data } = await api.get<Cliente>(`/clientes/${id}`);
  return data;
}

export async function criarCliente(dados: DadosCliente): Promise<number> {
  const { data } = await api.post<{ mensagem: string; idCliente: number }>("/clientes", dados);
  return data.idCliente;
}

export async function atualizarCliente(id: number, dados: DadosCliente): Promise<void> {
  await api.put(`/clientes/${id}`, dados);
}

export async function excluirCliente(id: number): Promise<void> {
  await api.delete(`/clientes/${id}`);
}
