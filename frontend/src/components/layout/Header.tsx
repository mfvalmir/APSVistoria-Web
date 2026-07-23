import { LogOut, Menu, Moon, Sun, User } from "lucide-react";
import pkg from "../../../package.json";
import { Tema } from "../../utils/theme";
import "./Header.css";

const VERSAO_APP = pkg.version;

interface HeaderProps {
  titulo: string;
  grupo: string | null;
  nomeUsuario: string;
  tema: Tema;
  onAlternarTema: () => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

function Header({
  titulo,
  grupo,
  nomeUsuario,
  tema,
  onAlternarTema,
  onToggleSidebar,
  onLogout,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <button
          className="app-header-toggle"
          onClick={onToggleSidebar}
          aria-label="Alternar menu"
          type="button"
        >
          <Menu size={20} />
        </button>
        <img className="app-header-brand" src="/images/logo-aps-vistoria.png" alt="APS Vistoria" />
        <span className="app-header-versao">v{VERSAO_APP}</span>
        <span className="app-header-divisor" aria-hidden="true" />
        <span className="app-header-trilha">
          {grupo && (
            <>
              <span className="app-header-grupo">{grupo}</span>
              <span className="app-header-separator">›</span>
            </>
          )}
          <span className="app-header-titulo">{titulo}</span>
        </span>
      </div>

      <div className="app-header-right">
        <span className="app-header-usuario">
          <User size={16} />
          {nomeUsuario}
        </span>

        <button
          className="app-header-theme-btn"
          onClick={onAlternarTema}
          aria-label="Alternar tema claro/escuro"
          type="button"
        >
          {tema === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          className="app-header-logout"
          onClick={onLogout}
          aria-label="Sair"
          title="Sair"
          type="button"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

export default Header;
