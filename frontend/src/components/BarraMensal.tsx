import { useState } from "react";
import "./BarraMensal.css";

interface BarraMensalProps {
  titulo: string;
  dados: { rotulo: string; valor: number }[];
  cor: "sequencial-1" | "sequencial-2";
  formatarValor: (valor: number) => string;
}

function BarraMensal({ titulo, dados, cor, formatarValor }: BarraMensalProps) {
  const [emFoco, setEmFoco] = useState<number | null>(null);
  const maximo = Math.max(1, ...dados.map((d) => d.valor));

  return (
    <div className="barra-mensal">
      <h3 className="barra-mensal-titulo">{titulo}</h3>
      <div className="barra-mensal-area">
        {dados.map((d, i) => {
          const alturaPercentual = (d.valor / maximo) * 100;
          return (
            <div
              key={d.rotulo + i}
              className="barra-mensal-coluna"
              onMouseEnter={() => setEmFoco(i)}
              onMouseLeave={() => setEmFoco(null)}
            >
              {emFoco === i && (
                <div className="barra-mensal-tooltip">
                  {d.rotulo}: {formatarValor(d.valor)}
                </div>
              )}
              {d.valor > 0 && <span className="barra-mensal-valor">{formatarValor(d.valor)}</span>}
              <div
                className={`barra-mensal-barra barra-mensal-barra-${cor}`}
                style={{ height: d.valor > 0 ? `${Math.max(alturaPercentual, 3)}%` : "2px" }}
              />
              <span className="barra-mensal-rotulo">{d.rotulo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BarraMensal;
