import { useState } from "react";
import { DashboardFluxoCaixaDia } from "../api/dashboard";
import "./FluxoCaixaChart.css";

interface FluxoCaixaChartProps {
  dados: DashboardFluxoCaixaDia[];
  formatarValor: (valor: number) => string;
}

function formatarDiaResumido(diaIso: string): string {
  const [, mes, dia] = diaIso.split("-");
  return `${dia}/${mes}`;
}

function FluxoCaixaChart({ dados, formatarValor }: FluxoCaixaChartProps) {
  const [emFoco, setEmFoco] = useState<number | null>(null);

  const nets = dados.map((d) => d.entrada - d.saida);
  const maximoAbs = Math.max(1, ...nets.map((n) => Math.abs(n)));

  return (
    <div className="fluxo-caixa-chart">
      <h3 className="fluxo-caixa-titulo">Fluxo de caixa líquido (últimos 30 dias)</h3>
      <div className="fluxo-caixa-area">
        <div className="fluxo-caixa-linha-base" />
        {dados.map((d, i) => {
          const net = nets[i];
          const alturaPercentual = (Math.abs(net) / maximoAbs) * 50;
          const positivo = net >= 0;
          const mostrarRotulo = i % 5 === 0 || i === dados.length - 1;
          return (
            <div
              key={d.dia}
              className="fluxo-caixa-coluna"
              onMouseEnter={() => setEmFoco(i)}
              onMouseLeave={() => setEmFoco(null)}
            >
              {emFoco === i && (
                <div className={`fluxo-caixa-tooltip ${positivo ? "acima" : "abaixo"}`}>
                  <strong>{formatarDiaResumido(d.dia)}</strong>
                  <span>Entradas: {formatarValor(d.entrada)}</span>
                  <span>Saídas: {formatarValor(d.saida)}</span>
                  <span>Líquido: {formatarValor(net)}</span>
                </div>
              )}
              <div className="fluxo-caixa-barra-wrapper">
                {positivo ? (
                  <div
                    className="fluxo-caixa-barra fluxo-caixa-barra-positiva"
                    style={{ height: `${Math.max(alturaPercentual, net !== 0 ? 3 : 0)}%` }}
                  />
                ) : (
                  <div
                    className="fluxo-caixa-barra fluxo-caixa-barra-negativa"
                    style={{ height: `${Math.max(alturaPercentual, 3)}%` }}
                  />
                )}
              </div>
              <span className="fluxo-caixa-rotulo">{mostrarRotulo ? formatarDiaResumido(d.dia) : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="fluxo-caixa-legenda">
        <span className="fluxo-caixa-legenda-item">
          <span className="fluxo-caixa-legenda-cor positiva" /> Entradas &gt; saídas
        </span>
        <span className="fluxo-caixa-legenda-item">
          <span className="fluxo-caixa-legenda-cor negativa" /> Saídas &gt; entradas
        </span>
      </div>
    </div>
  );
}

export default FluxoCaixaChart;
