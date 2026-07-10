import axios from "axios";

// A URL da API vem da variável de ambiente VITE_API_URL.
// Assim, ao mudar de rede interna -> internet, só troca o .env do frontend.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Se/quando ativar login, injeta o token JWT automaticamente em toda requisição.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
