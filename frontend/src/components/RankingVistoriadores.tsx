import { Printer } from "lucide-react";
import "./RankingVistoriadores.css";

interface RankingVistoriadoresProps {
  dados: { idVistoriador: number; nome: string; quantidade: number; faturamento: number }[];
  formatarValor: (valor: number) => string;
  aoImprimirRelatorio: () => void;
  imprimindoRelatorio: boolean;
}

function RankingVistoriadores({
  dados,
  formatarValor,
  aoImprimirRelatorio,
  imprimindoRelatorio,
}: RankingVistoriadoresProps) {
  const maximo = Math.max(1, ...dados.map((d) => d.quantidade));

  return (
    <div className="ranking-vistoriadores">
      <div className="ranking-vistoriadores-cabecalho">
        <h3 className="ranking-vistoriadores-titulo">Ranking de vistoriadores no mês</h3>
        <button
          type="button"
          className="ranking-vistoriadores-btn-imprimir"
          onClick={aoImprimirRelatorio}
          disabled={imprimindoRelatorio || dados.length === 0}
          title={imprimindoRelatorio ? "Gerando relatório..." : "Imprimir relatório detalhado por vistoriador"}
          aria-label="Imprimir relatório detalhado por vistoriador"
        >
          <Printer size={16} />
        </button>
      </div>
      {dados.length === 0 ? (
        <p className="ranking-vistoriadores-vazio">Nenhuma vistoria no mês.</p>
      ) : (
        <ol className="ranking-vistoriadores-lista">
          {dados.map((d, i) => (
            <li key={d.idVistoriador} className="ranking-vistoriadores-item">
              <span className={`ranking-vistoriadores-posicao ranking-vistoriadores-posicao-${i}`}>{i + 1}</span>
              <div className="ranking-vistoriadores-corpo">
                <div className="ranking-vistoriadores-linha">
                  <span className="ranking-vistoriadores-nome">{d.nome}</span>
                  <span className="ranking-vistoriadores-quantidade">{d.quantidade}</span>
                </div>
                <div className="ranking-vistoriadores-barra-fundo">
                  <div
                    className="ranking-vistoriadores-barra-preenchida"
                    style={{ width: `${(d.quantidade / maximo) * 100}%` }}
                  />
                </div>
                <span className="ranking-vistoriadores-faturamento">{formatarValor(d.faturamento)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default RankingVistoriadores;
