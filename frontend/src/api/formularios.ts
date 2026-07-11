import { api } from "./client";

export interface Formulario {
  FormularioID: number;
  NomeFormulario: string;
  Descricao: string | null;
  Ativo: string;
  Grupo: string | null;
  Ordem: number | null;
  Icone: string | null;
}

export interface DadosFormulario {
  nomeFormulario: string;
  descricao?: string;
  grupo?: string;
  ordem?: number | null;
  icone?: string;
}

export interface EdicaoFormulario extends DadosFormulario {
  ativo: "A" | "I";
}

export async function listarFormularios(busca?: string, status?: "A" | "I"): Promise<Formulario[]> {
  const { data } = await api.get<Formulario[]>("/formularios", { params: { busca, status } });
  return data;
}

export async function obterFormulario(id: number): Promise<Formulario> {
  const { data } = await api.get<Formulario>(`/formularios/${id}`);
  return data;
}

export async function criarFormulario(dados: DadosFormulario): Promise<void> {
  await api.post("/formularios", dados);
}

export async function atualizarFormulario(id: number, dados: EdicaoFormulario): Promise<void> {
  await api.put(`/formularios/${id}`, dados);
}

export async function desativarFormulario(id: number): Promise<void> {
  await api.delete(`/formularios/${id}`);
}

export async function buscarGrupos(): Promise<string[]> {
  const { data } = await api.get<string[]>("/formularios/grupos");
  return data;
}
