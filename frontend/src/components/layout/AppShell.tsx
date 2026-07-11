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
    navegarPara: (rota: string, nome: string, grupo: string) => void;
    irParaInicio: () => void;
  }) => React.ReactNode;
}

function AppShell({ nomeUsuario, tema, onAlternarTema, onLogout, children }: AppShellProps) {
  const [grupos, setGrupos] = useState<GrupoMenu[]>([]);
  const [carregandoMenu, setCarregandoMenu] = useState(true);
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [rotaAtual, setRotaAtual] = useState<string | null>(null);
  const [tituloAtual, setTituloAtual] = useState("Início");
  const [grupoAtual, setGrupoAtual] = useState<string | null>(null);

  useEffect(() => {
    buscarMenu()
      .then(setGrupos)
      .finally(() => setCarregandoMenu(false));
  }, []);

  function selecionarItem(rota: string, nome: string, grupo: string) {
    setRotaAtual(rota);
    setTituloAtual(nome);
    setGrupoAtual(grupo);
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
          navegarPara: selecionarItem,
          irParaInicio,
        })}
      </main>
    </div>
  );
}

export default AppShell;
