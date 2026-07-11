import { useEffect, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import "./SeletorColunas.css";

export interface OpcaoColuna {
  chave: string;
  label: string;
}

interface SeletorColunasProps {
  colunas: OpcaoColuna[];
  visiveis: Set<string>;
  onToggle: (chave: string) => void;
}

function SeletorColunas({ colunas, visiveis, onToggle }: SeletorColunasProps) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div className="seletor-colunas" ref={ref}>
      <button
        type="button"
        className="seletor-colunas-btn"
        title="Colunas"
        onClick={() => setAberto((v) => !v)}
      >
        <Columns3 size={16} />
      </button>
      {aberto && (
        <div className="seletor-colunas-painel">
          {colunas.map((c) => (
            <label key={c.chave} className="seletor-colunas-item">
              <input type="checkbox" checked={visiveis.has(c.chave)} onChange={() => onToggle(c.chave)} />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default SeletorColunas;
