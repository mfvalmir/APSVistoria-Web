import { api } from "./client";

export interface Fornecedor {
  idFornecedor: number;
  RazaoSocial: string;
  NomeFantasia: string | null;
  CpfCnpj: string | null;
  Telefone: string | null;
  Email: string | null;
  Observacao: string | null;
  Ativo: string;
}

export interface DadosFornecedor {
  razaoSocial: string;
  nomeFantasia?: string;
  cpfCnpj?: string;
  telefone?: string;
  email?: string;
  observacao?: string;
}

export interface EdicaoFornecedor extends DadosFornecedor {
  ativo: "A" | "I";
}

export async function listarFornecedores(busca?: string, status?: "A" | "I"): Promise<Fornecedor[]> {
  const { data } = await api.get<Fornecedor[]>("/fornecedores", { params: { busca, status } });
  return data;
}

export async function obterFornecedor(id: number): Promise<Fornecedor> {
  const { data } = await api.get<Fornecedor>(`/fornecedores/${id}`);
  return data;
}

export async function criarFornecedor(dados: DadosFornecedor): Promise<{ idFornecedor: number }> {
  const { data } = await api.post("/fornecedores", dados);
  return data;
}

export async function atualizarFornecedor(id: number, dados: EdicaoFornecedor): Promise<void> {
  await api.put(`/fornecedores/${id}`, dados);
}

export async function desativarFornecedor(id: number): Promise<void> {
  await api.delete(`/fornecedores/${id}`);
}
