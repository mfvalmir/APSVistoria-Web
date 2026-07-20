import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportarCsv, ColunaExportacao } from "../utils/exportarCsv";
import { exportarPdf } from "../utils/exportarPdf";
import "./BotaoExportar.css";

interface BotaoExportarProps<T> {
  nomeArquivo: string;
  titulo: string;
  dados: T[];
  colunas: ColunaExportacao<T>[];
}

function BotaoExportar<T>({ nomeArquivo, titulo, dados, colunas }: BotaoExportarProps<T>) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div className="botao-exportar" ref={ref}>
      <button
        type="button"
        className="btn-exportar-csv"
        title="Exportar"
        aria-label="Exportar"
        onClick={() => setAberto((v) => !v)}
      >
        <Download size={16} />
      </button>
      {aberto && (
        <div className="botao-exportar-menu">
          <button
            type="button"
            onClick={() => {
              exportarCsv(nomeArquivo, dados, colunas);
              setAberto(false);
            }}
          >
            <FileSpreadsheet size={14} />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => {
              exportarPdf(nomeArquivo, titulo, dados, colunas);
              setAberto(false);
            }}
          >
            <FileText size={14} />
            Exportar PDF
          </button>
        </div>
      )}
    </div>
  );
}

export default BotaoExportar;
