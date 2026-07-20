import { useEffect, useState } from "react";
import Login from "./pages/Login";
import AppShell from "./components/layout/AppShell";
import UsuariosPage from "./pages/UsuariosPage";
import FuncionariosPage from "./pages/FuncionariosPage";
import FormulariosPage from "./pages/FormulariosPage";
import CidadesPage from "./pages/CidadesPage";
import BairrosPage from "./pages/BairrosPage";
import FuncaoPage from "./pages/FuncaoPage";
import CategoriaPage from "./pages/CategoriaPage";
import BancoPage from "./pages/BancoPage";
import ClientesPage from "./pages/ClientesPage";
import ServicoPage from "./pages/ServicoPage";
import TipoPagamentoPage from "./pages/TipoPagamentoPage";
import FornecedorPage from "./pages/FornecedorPage";
import ContaPagarPage from "./pages/ContaPagarPage";
import ContaReceberPage from "./pages/ContaReceberPage";
import CaixaPage from "./pages/CaixaPage";
import VistoriaPage from "./pages/VistoriaPage";
import Placeholder from "./pages/Placeholder";
import Inicio from "./pages/Inicio";
import OfflineBanner from "./components/OfflineBanner";
import { decodeToken } from "./utils/jwt";
import { obterTemaInicial, aplicarTema, Tema } from "./utils/theme";

interface TokenPayload {
  nome: string;
  administrador: boolean;
  exp: number;
}

function tokenPayload(): TokenPayload | null {
  const token = sessionStorage.getItem("token");
  if (!token) return null;
  return decodeToken<TokenPayload>(token);
}

// Token ausente, corrompido ou com `exp` (segundos desde epoch) no passado
// nunca deve contar como sessão válida - Login tem que ser sempre a primeira tela nesses casos.
function sessaoValida(): boolean {
  const payload = tokenPayload();
  if (!payload) return false;
  return payload.exp * 1000 > Date.now();
}

function nomeUsuarioLogado(): string {
  return tokenPayload()?.nome || "";
}

function administradorLogado(): boolean {
  return tokenPayload()?.administrador || false;
}

function App() {
  const [autenticado, setAutenticado] = useState(sessaoValida);
  const [tema, setTema] = useState<Tema>(obterTemaInicial);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  function alternarTema() {
    setTema((atual) => (atual === "light" ? "dark" : "light"));
  }

  function handleLogout() {
    sessionStorage.removeItem("token");
    setAutenticado(false);
  }

  if (!autenticado) {
    return (
      <>
        <OfflineBanner />
        <Login onLoginSuccess={() => setAutenticado(true)} />
      </>
    );
  }

  return (
    <>
      <OfflineBanner />
      <AppShell
        nomeUsuario={nomeUsuarioLogado()}
        tema={tema}
        onAlternarTema={alternarTema}
        onLogout={handleLogout}
      >
        {({ rota, titulo, permissoes, podeVerInicio, navegarPara, irParaInicio }) => {
          if (rota === "usuario") {
            return (
              <UsuariosPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "funcionarios") {
            return (
              <FuncionariosPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                navegarPara={navegarPara}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "formularios") {
            return (
              <FormulariosPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "cidades") {
            return (
              <CidadesPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "bairros") {
            return (
              <BairrosPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                navegarPara={navegarPara}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "funcao") {
            return (
              <FuncaoPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "categoria") {
            return (
              <CategoriaPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "banco") {
            return (
              <BancoPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "clientes") {
            return (
              <ClientesPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "servicos") {
            return (
              <ServicoPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "tipo-pagamento") {
            return (
              <TipoPagamentoPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "fornecedor") {
            return (
              <FornecedorPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "conta-pagar") {
            return (
              <ContaPagarPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                navegarPara={navegarPara}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "conta-receber") {
            return (
              <ContaReceberPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                navegarPara={navegarPara}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "caixa") {
            return (
              <CaixaPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                navegarPara={navegarPara}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === "vistoria") {
            return (
              <VistoriaPage
                permissoes={permissoes}
                administrador={administradorLogado()}
                navegarPara={navegarPara}
                voltarInicio={irParaInicio}
              />
            );
          }
          if (rota === null) {
            return podeVerInicio ? (
              <Inicio />
            ) : (
              <div>
                <h2>Bem-vindo(a), {nomeUsuarioLogado()}!</h2>
              </div>
            );
          }
          return <Placeholder titulo={titulo} />;
        }}
      </AppShell>
    </>
  );
}

export default App;
