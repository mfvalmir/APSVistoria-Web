import { api } from "./client";

export interface ItemMenu {
  id: number;
  nome: string;
  icone: string | null;
  rota: string;
  permissoes: {
    adicionar: boolean;
    editar: boolean;
    excluir: boolean;
    imprimir: boolean;
    baixarParCP: boolean;
    estornarParCP: boolean;
    baixarParCR: boolean;
    estornarParCR: boolean;
  };
}

export interface GrupoMenu {
  grupo: string;
  itens: ItemMenu[];
}

export interface RespostaMenu {
  grupos: GrupoMenu[];
  podeVerInicio: boolean;
}

export async function buscarMenu(): Promise<RespostaMenu> {
  const { data } = await api.get<RespostaMenu>("/menu");
  return data;
}
