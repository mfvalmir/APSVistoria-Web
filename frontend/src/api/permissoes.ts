import { api } from "./client";

export interface AplicacaoDisponivel {
  formularioId: number;
  descricao: string;
  grupo: string;
}

export interface AplicacaoRepassada extends AplicacaoDisponivel {
  acessoFormulario: boolean;
  podeAdicionar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeImprimir: boolean;
  podeBaixarParCP: boolean;
  podeEstornarParCP: boolean;
  podeBaixarParCR: boolean;
  podeEstornarParCR: boolean;
}

export interface ArvorePermissoes {
  usuario: {
    idUser: number;
    login: string;
    nomeFuncionario: string | null;
  };
  disponiveis: AplicacaoDisponivel[];
  repassadas: AplicacaoRepassada[];
}

export type CampoPermissao =
  | "acessoFormulario"
  | "podeAdicionar"
  | "podeEditar"
  | "podeExcluir"
  | "podeImprimir"
  | "podeBaixarParCP"
  | "podeEstornarParCP"
  | "podeBaixarParCR"
  | "podeEstornarParCR";

export async function buscarPermissoes(usuarioId: number): Promise<ArvorePermissoes> {
  const { data } = await api.get<ArvorePermissoes>(`/usuarios/${usuarioId}/permissoes`);
  return data;
}

export async function concederPermissoes(usuarioId: number, formularioIds: number[]): Promise<void> {
  await api.post(`/usuarios/${usuarioId}/permissoes`, { formularioIds });
}

export async function removerPermissao(usuarioId: number, formularioId: number): Promise<void> {
  await api.delete(`/usuarios/${usuarioId}/permissoes/${formularioId}`);
}

export async function alternarPermissao(
  usuarioId: number,
  formularioId: number,
  campo: CampoPermissao,
  valor: boolean
): Promise<void> {
  await api.patch(`/usuarios/${usuarioId}/permissoes/${formularioId}`, { campo, valor });
}
