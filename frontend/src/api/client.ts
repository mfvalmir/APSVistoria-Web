import axios from "axios";

// Por padrão a API é descoberta automaticamente a partir do host usado pra
// acessar a página (mesmo hostname/IP, porta 3000). Assim o mesmo build funciona
// tanto acessando pelo hostname do PC quanto pelo IP direto (ex: celular na rede
// local), sem precisar fixar um endereço. VITE_API_URL continua disponível como
// override manual para casos que fujam desse padrão (ex: produção atrás de proxy).
const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

export const api = axios.create({
  baseURL: apiBaseUrl,
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
