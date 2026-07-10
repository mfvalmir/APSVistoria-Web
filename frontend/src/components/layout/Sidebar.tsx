import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, Home } from "lucide-react";
import { GrupoMenu } from "../../api/menu";
import { getIcone } from "../iconRegistry";
import "./Sidebar.css";

interface SidebarProps {
  grupos: GrupoMenu[];
  rotaAtual: string | null;
  aberto: boolean;
  onSelecionarItem: (rota: string, nome: string, grupo: string) => void;
  onIrParaInicio: () => void;
}

function Sidebar({ grupos, rotaAtual, aberto, onSelecionarItem, onIrParaInicio }: SidebarProps) {
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(
    () => new Set(grupos.map((g) => g.grupo))
  );

  function alternarGrupo(grupo: string) {
    setGruposExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(grupo)) {
        novo.delete(grupo);
      } else {
        novo.add(grupo);
      }
      return novo;
    });
  }

  return (
    <nav className={`app-sidebar ${aberto ? "" : "app-sidebar-collapsed"}`}>
      <ul className="app-sidebar-tree">
        <li className="app-sidebar-grupo">
          <button
            type="button"
            className={`app-sidebar-inicio-btn ${rotaAtual === null ? "app-sidebar-item-ativo" : ""}`}
            onClick={onIrParaInicio}
          >
            <Home size={16} />
            <span>Início</span>
          </button>
        </li>

        {grupos.map((grupo) => {
          const expandido = gruposExpandidos.has(grupo.grupo);
          return (
            <li key={grupo.grupo} className="app-sidebar-grupo">
              <button
                type="button"
                className="app-sidebar-grupo-btn"
                onClick={() => alternarGrupo(grupo.grupo)}
              >
                {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Folder size={16} />
                <span>{grupo.grupo}</span>
              </button>

              {expandido && (
                <ul className="app-sidebar-itens">
                  {grupo.itens.map((item) => {
                    const Icone = getIcone(item.icone);
                    const ativo = item.rota === rotaAtual;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`app-sidebar-item ${ativo ? "app-sidebar-item-ativo" : ""}`}
                          onClick={() => onSelecionarItem(item.rota, item.nome, grupo.grupo)}
                        >
                          <Icone size={16} />
                          <span>{item.nome}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default Sidebar;
