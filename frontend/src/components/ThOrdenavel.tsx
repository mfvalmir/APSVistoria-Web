import { ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { EstadoOrdenacao } from "../utils/ordenacao";
import "./ThOrdenavel.css";

interface ThOrdenavelProps {
  campo: string;
  ordenacao: EstadoOrdenacao;
  onOrdenar: (campo: string) => void;
  className?: string;
  children: ReactNode;
}

function ThOrdenavel({ campo, ordenacao, onOrdenar, className, children }: ThOrdenavelProps) {
  const ativo = ordenacao.campo === campo;
  return (
    <th className={`th-ordenavel${className ? ` ${className}` : ""}`} onClick={() => onOrdenar(campo)}>
      <span className="th-ordenavel-conteudo">
        {children}
        {ativo ? (
          ordenacao.direcao === "asc" ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )
        ) : (
          <ChevronsUpDown size={14} className="th-ordenavel-icone-inativo" />
        )}
      </span>
    </th>
  );
}

export default ThOrdenavel;
