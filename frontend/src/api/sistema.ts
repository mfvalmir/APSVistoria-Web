import { api } from "./client";

export interface InfoSistema {
  status: string;
  banco: string;
}

export async function buscarInfoSistema(): Promise<InfoSistema> {
  const { data } = await api.get<InfoSistema>("/health");
  return data;
}
