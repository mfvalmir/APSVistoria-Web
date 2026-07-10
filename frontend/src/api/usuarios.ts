import { api } from "./client";

export interface Usuario {
  IDUser: number;
  IDFuncionario: number;
  Loginn: string;
  Situacao: string;
  Administrador: string;
  NomeFuncionario: string | null;
}

export interface NovoUsuario {
  idFuncionario: number;
  login: string;
  senha: string;
  administrador: boolean;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data } = await api.get<Usuario[]>("/usuarios");
  return data;
}

export async function criarUsuario(dados: NovoUsuario): Promise<void> {
  await api.post("/usuarios", dados);
}
