import axios from "axios";

// A URL da API vem da variável de ambiente VITE_API_URL.
// Assim, ao mudar de rede interna -> internet, só troca o .env do frontend.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Token em sessionStorage (não localStorage): mantém login ao recarregar a página,
// mas encerra a sessão ao fechar a aba.
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Token expirado/inválido em qualquer chamada autenticada: limpa a sessão e força
// a volta pro Login (em vez de deixar a página atual quebrada chamando API sem sessão válida).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && sessionStorage.getItem("token")) {
      sessionStorage.removeItem("token");
      window.location.reload();
    }
    return Promise.reject(error);
  }
);
