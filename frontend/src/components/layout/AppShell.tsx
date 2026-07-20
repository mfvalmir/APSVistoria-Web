import { useEffect, useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { buscarMenu, GrupoMenu, ItemMenu } from "../../api/menu";
import { Tema } from "../../utils/theme";
import "./AppShell.css";

interface AppShellProps {
  nomeUsuario: string;
  tema: Tema;
  onAlternarTema: () => void;
  onLogout: () => void;
  children: (paginaAtual: {
    rota: string | null;
    titulo: string;
    permissoes: ItemMenu["permissoes"] | null;
    podeVerInicio: boolean;
    navegarPara: (rota: string, nome: string, grupo: string) => void;
    irParaInicio: () => void;
  }) => React.ReactNode;
}

// Abaixo de 1024px a sidebar vira um overlay flutuante (ver AppShell.css/Sidebar.css) em vez de
// empurrar o conteúdo - por isso já entra fechada nessa faixa, evitando cobrir a tela inteira
// no primeiro carregamento em tablet.
function sidebarDeveIniciarAberta(): boolean {
  return typeof window === "undefined" || window.innerWidth > 1024;
}

function AppShell({ nomeUsuario, tema, onAlternarTema, onLogout, children }: AppShellProps) {
  const [grupos, setGrupos] = useState<GrupoMenu[]>([]);
  const [podeVerInicio, setPodeVerInicio] = useState(false);
  const [carregandoMenu, setCarregandoMenu] = useState(true);
  const [sidebarAberta, setSidebarAberta] = useState(sidebarDeveIniciarAberta);
  const [rotaAtual, setRotaAtual] = useState<string | null>(null);
  const [tituloAtual, setTituloAtual] = useState("Início");
  const [grupoAtual, setGrupoAtual] = useState<string | null>(null);

  useEffect(() => {
    buscarMenu()
      .then(({ grupos, podeVerInicio }) => {
        setGrupos(grupos);
        setPodeVerInicio(podeVerInicio);
      })
      .finally(() => setCarregandoMenu(false));
  }, []);

  function selecionarItem(rota: string, nome: string, grupo: string) {
    setRotaAtual(rota);
    setTituloAtual(nome);
    setGrupoAtual(grupo);
    // Em tablet a sidebar é um overlay por cima do conteúdo - fecha sozinha ao navegar, senão
    // ficaria cobrindo a tela recém-aberta até o usuário fechar manualmente.
    if (!sidebarDeveIniciarAberta()) setSidebarAberta(false);
  }

  function irParaInicio() {
    setRotaAtual(null);
    setTituloAtual("Início");
    setGrupoAtual(null);
  }

  const itemAtual = grupos.flatMap((g) => g.itens).find((item) => item.rota === rotaAtual) || null;

  return (
    <div className="app-shell">
      <Header
        titulo={tituloAtual}
        grupo={grupoAtual}
        nomeUsuario={nomeUsuario}
        tema={tema}
        onAlternarTema={onAlternarTema}
        onToggleSidebar={() => setSidebarAberta((v) => !v)}
        onLogout={onLogout}
      />

      {!carregandoMenu && (
        <Sidebar
          grupos={grupos}
          rotaAtual={rotaAtual}
          aberto={sidebarAberta}
          onSelecionarItem={selecionarItem}
          onIrParaInicio={irParaInicio}
        />
      )}

      <main className="app-content">
        {children({
          rota: rotaAtual,
          titulo: tituloAtual,
          permissoes: itemAtual?.permissoes || null,
          podeVerInicio,
          navegarPara: selecionarItem,
          irParaInicio,
        })}
      </main>
    </div>
  );
}

export default AppShell;
