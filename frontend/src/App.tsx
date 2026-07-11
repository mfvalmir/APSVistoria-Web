import { useEffect, useState } from "react";
import Login from "./pages/Login";
import AppShell from "./components/layout/AppShell";
import UsuariosPage from "./pages/UsuariosPage";
import FuncionariosPage from "./pages/FuncionariosPage";
import FormulariosPage from "./pages/FormulariosPage";
import Placeholder from "./pages/Placeholder";
import { decodeToken } from "./utils/jwt";
import { obterTemaInicial, aplicarTema, Tema } from "./utils/theme";

interface TokenPayload {
  nome: string;
  administrador: boolean;
}

function tokenPayload(): TokenPayload | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return decodeToken<TokenPayload>(token);
}

function nomeUsuarioLogado(): string {
  return tokenPayload()?.nome || "";
}

function administradorLogado(): boolean {
  return tokenPayload()?.administrador || false;
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
      {({ rota, titulo, permissoes, navegarPara }) => {
        if (rota === "usuario") {
          return (
            <UsuariosPage
              permissoes={permissoes}
              administrador={administradorLogado()}
            />
          );
        }
        if (rota === "funcionarios") {
          return (
            <FuncionariosPage
              permissoes={permissoes}
              administrador={administradorLogado()}
              navegarPara={navegarPara}
            />
          );
        }
        if (rota === "formularios") {
          return (
            <FormulariosPage
              permissoes={permissoes}
              administrador={administradorLogado()}
            />
          );
        }
        if (rota === null) return <Placeholder titulo="Início" />;
        return <Placeholder titulo={titulo} />;
      }}
    </AppShell>
  );
}

export default App;
