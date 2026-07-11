import { api } from "./client";

export interface Usuario {
  IDUser: number;
  IDFuncionario: number;
  Loginn: string;
  Situacao: string;
  Administrador: string;
  NomeFuncionario: string | null;
  Funcao: string | null;
}

export interface NovoUsuario {
  idFuncionario: number;
  login: string;
  senha: string;
  administrador: boolean;
}

export interface EdicaoUsuario {
  login: string;
  status: "A" | "I";
  administrador: boolean;
}

export interface AlteracaoSenha {
  senhaAtual: string;
  novaSenha: string;
}

export async function listarUsuarios(busca?: string, status?: "A" | "I"): Promise<Usuario[]> {
  const { data } = await api.get<Usuario[]>("/usuarios", { params: { busca, status } });
  return data;
}

export async function obterUsuario(id: number): Promise<Usuario> {
  const { data } = await api.get<Usuario>(`/usuarios/${id}`);
  return data;
}

export async function criarUsuario(dados: NovoUsuario): Promise<void> {
  await api.post("/usuarios", dados);
}

export async function atualizarUsuario(id: number, dados: EdicaoUsuario): Promise<void> {
  await api.put(`/usuarios/${id}`, dados);
}

export async function alterarSenha(id: number, dados: AlteracaoSenha): Promise<void> {
  await api.put(`/usuarios/${id}/senha`, dados);
}

export async function desativarUsuario(id: number): Promise<void> {
  await api.delete(`/usuarios/${id}`);
}
