import { api } from "./client";

export async function login(usuario: string, senha: string): Promise<string> {
  const { data } = await api.post<{ token: string }>("/auth/login", { usuario, senha });
  return data.token;
}
