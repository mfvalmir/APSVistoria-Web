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
  };
}

export interface GrupoMenu {
  grupo: string;
  itens: ItemMenu[];
}

export async function buscarMenu(): Promise<GrupoMenu[]> {
  const { data } = await api.get<GrupoMenu[]>("/menu");
  return data;
}
