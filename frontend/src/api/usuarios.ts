import { api } from "./client";

export interface Usuario {
  id: number;
  nome: string;
  usuario: string;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data } = await api.get<Usuario[]>("/usuarios");
  return data;
}

export async function criarUsuario(nome: string, usuario: string): Promise<void> {
  await api.post("/usuarios", { nome, usuario });
}
