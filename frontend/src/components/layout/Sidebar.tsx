import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, Home, Search, X } from "lucide-react";
import { GrupoMenu } from "../../api/menu";
import { buscarInfoSistema } from "../../api/sistema";
import { getIcone } from "../iconRegistry";
import "./Sidebar.css";

interface SidebarProps {
  grupos: GrupoMenu[];
  rotaAtual: string | null;
  aberto: boolean;
  onSelecionarItem: (rota: string, nome: string, grupo: string) => void;
  onIrParaInicio: () => void;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function Sidebar({ grupos, rotaAtual, aberto, onSelecionarItem, onIrParaInicio }: SidebarProps) {
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(() => new Set());
  const [banco, setBanco] = useState("");
  const [busca, setBusca] = useState("");

  const buscando = busca.trim().length > 0;

  const gruposFiltrados = useMemo(() => {
    if (!buscando) return grupos;
    const termo = normalizar(busca.trim());
    return grupos
      .map((grupo) => ({
        ...grupo,
        itens: grupo.itens.filter((item) => normalizar(item.nome).includes(termo)),
      }))
      .filter((grupo) => grupo.itens.length > 0);
  }, [grupos, busca, buscando]);

  useEffect(() => {
    buscarInfoSistema()
      .then((info) => setBanco(info.banco))
      .catch(() => setBanco(""));
  }, []);

  // Toda vez que a página Início é acessada, o menu volta a ficar todo recolhido
  // (pastas de grupo fechadas), em vez de manter a última árvore expandida.
  useEffect(() => {
    if (rotaAtual === null) {
      setGruposExpandidos(new Set());
    }
  }, [rotaAtual]);

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
      <div className="app-sidebar-busca">
        <Search size={14} />
        <input
          placeholder="Buscar no menu..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && (
          <button
            type="button"
            className="app-sidebar-busca-limpar"
            title="Limpar busca"
            aria-label="Limpar busca"
            onClick={() => setBusca("")}
          >
            <X size={14} />
          </button>
        )}
      </div>

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

        {buscando && gruposFiltrados.length === 0 && (
          <li className="app-sidebar-busca-vazio">Nenhum item encontrado</li>
        )}

        {gruposFiltrados.map((grupo) => {
          const expandido = buscando || gruposExpandidos.has(grupo.grupo);
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

      <div className="app-sidebar-rodape">
        <span>APS Vistoria &copy; {new Date().getFullYear()}</span>
        {banco && <span>Banco de dados: {banco}</span>}
        <span>Desenvolvido por Valmir Fco. Magalhães</span>
      </div>
    </nav>
  );
}

export default Sidebar;
