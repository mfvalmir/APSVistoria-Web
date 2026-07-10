import { useEffect, useState } from "react";
import Login from "./pages/Login";
import AppShell from "./components/layout/AppShell";
import UsuariosPage from "./pages/UsuariosPage";
import Placeholder from "./pages/Placeholder";
import { decodeToken } from "./utils/jwt";
import { obterTemaInicial, aplicarTema, Tema } from "./utils/theme";

interface TokenPayload {
  nome: string;
}

function nomeUsuarioLogado(): string {
  const token = localStorage.getItem("token");
  if (!token) return "";
  const payload = decodeToken<TokenPayload>(token);
  return payload?.nome || "";
}

function App() {
  const [autenticado, setAutenticado] = useState(() => !!localStorage.getItem("token"));
  const [tema, setTema] = useState<Tema>(obterTemaInicial);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  function alternarTema() {
    setTema((atual) => (atual === "light" ? "dark" : "light"));
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setAutenticado(false);
  }

  if (!autenticado) {
    return <Login onLoginSuccess={() => setAutenticado(true)} />;
  }

  return (
    <AppShell
      nomeUsuario={nomeUsuarioLogado()}
      tema={tema}
      onAlternarTema={alternarTema}
      onLogout={handleLogout}
    >
      {({ rota, titulo }) => {
        if (rota === "usuario") return <UsuariosPage />;
        if (rota === null) return <Placeholder titulo="Início" />;
        return <Placeholder titulo={titulo} />;
      }}
    </AppShell>
  );
}

export default App;
