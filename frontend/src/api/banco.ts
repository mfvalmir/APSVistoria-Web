import { api } from "./client";

export interface Banco {
  idBanco: number;
  DescricaoBanco: string;
}

export interface DadosBanco {
  descricaoBanco: string;
}

export async function listarBancos(busca?: string): Promise<Banco[]> {
  const { data } = await api.get<Banco[]>("/banco", { params: { busca } });
  return data;
}

export async function obterBanco(id: number): Promise<Banco> {
  const { data } = await api.get<Banco>(`/banco/${id}`);
  return data;
}

export async function criarBanco(dados: DadosBanco): Promise<void> {
  await api.post("/banco", dados);
}

export async function atualizarBanco(id: number, dados: DadosBanco): Promise<void> {
  await api.put(`/banco/${id}`, dados);
}

export async function excluirBanco(id: number): Promise<void> {
  await api.delete(`/banco/${id}`);
}
