import { useEffect, useState } from "react";
import { Wallet, ArrowUpCircle, ArrowDownCircle, ClipboardCheck, AlertTriangle, Clock } from "lucide-react";
import { buscarDashboard, Dashboard } from "../api/dashboard";
import BarraMensal from "../components/BarraMensal";
import FluxoCaixaChart from "../components/FluxoCaixaChart";
import "./Inicio.css";

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function Inicio() {
  const [dados, setDados] = useState<Dashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    buscarDashboard()
      .then(setDados)
      .catch(() => setErro("Não foi possível carregar os dados do painel."))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return <div className="inicio-pagina">Carregando painel...</div>;
  }

  if (erro || !dados) {
    return <div className="inicio-pagina inicio-erro">{erro || "Sem dados."}</div>;
  }

  const { caixa, aReceberAberto, aPagarAberto, vistoriasMes, alertas, fluxoCaixa, vistoriasPorMes, tiposPagamento } = dados;

  return (
    <div className="inicio-pagina">
      <div className="inicio-kpis">
        <div className="inicio-kpi">
          <div className="inicio-kpi-icone inicio-kpi-icone-caixa">
            <Wallet size={20} />
          </div>
          <div className="inicio-kpi-corpo">
            <span className="inicio-kpi-label">Saldo em Caixa</span>
            <span className="inicio-kpi-valor">
              {caixa.aberto && caixa.saldoAtual !== null ? formatarValor(caixa.saldoAtual) : "—"}
            </span>
            <span className="inicio-kpi-nota">{caixa.aberto ? "Caixa aberto" : "Nenhum caixa aberto"}</span>
          </div>
        </div>

        <div className="inicio-kpi">
          <div className="inicio-kpi-icone inicio-kpi-icone-receber">
            <ArrowUpCircle size={20} />
          </div>
          <div className="inicio-kpi-corpo">
            <span className="inicio-kpi-label">A Receber em aberto</span>
            <span className="inicio-kpi-valor">{formatarValor(aReceberAberto)}</span>
          </div>
        </div>

        <div className="inicio-kpi">
          <div className="inicio-kpi-icone inicio-kpi-icone-pagar">
            <ArrowDownCircle size={20} />
          </div>
          <div className="inicio-kpi-corpo">
            <span className="inicio-kpi-label">A Pagar em aberto</span>
            <span className="inicio-kpi-valor">{formatarValor(aPagarAberto)}</span>
          </div>
        </div>

        <div className="inicio-kpi">
          <div className="inicio-kpi-icone inicio-kpi-icone-vistoria">
            <ClipboardCheck size={20} />
          </div>
          <div className="inicio-kpi-corpo">
            <span className="inicio-kpi-label">Vistorias no mês</span>
            <span className="inicio-kpi-valor">{vistoriasMes.quantidade}</span>
            <span className="inicio-kpi-nota">{formatarValor(vistoriasMes.faturamento)} faturados</span>
          </div>
        </div>
      </div>

      <div className="inicio-alertas-vencimentos">
        <div className="inicio-alertas">
          <div className={`inicio-alerta inicio-alerta-critica ${alertas.vencidas.quantidade === 0 ? "inicio-alerta-vazia" : ""}`}>
            <AlertTriangle size={18} />
            <div>
              <strong>{alertas.vencidas.quantidade}</strong> parcela(s) vencida(s)
              <span className="inicio-alerta-valor">{formatarValor(alertas.vencidas.valor)}</span>
            </div>
          </div>
          <div className={`inicio-alerta inicio-alerta-aviso ${alertas.vencendoEm7Dias.quantidade === 0 ? "inicio-alerta-vazia" : ""}`}>
            <Clock size={18} />
            <div>
              <strong>{alertas.vencendoEm7Dias.quantidade}</strong> vencendo nos próximos 7 dias
              <span className="inicio-alerta-valor">{formatarValor(alertas.vencendoEm7Dias.valor)}</span>
            </div>
          </div>
        </div>

        <div className="inicio-proximos">
          <h3 className="inicio-proximos-titulo">Próximos vencimentos</h3>
          {alertas.proximosVencimentos.length === 0 ? (
            <p className="inicio-proximos-vazio">Nenhum vencimento pendente.</p>
          ) : (
            <table className="inicio-proximos-tabela">
              <tbody>
                {alertas.proximosVencimentos.map((v) => (
                  <tr key={`${v.tipo}-${v.idParcela}`}>
                    <td>
                      <span className={`inicio-badge-tipo ${v.tipo}`}>{v.tipo === "pagar" ? "Pagar" : "Receber"}</span>
                    </td>
                    <td className="inicio-proximos-descricao">
                      {v.descricao}
                      {v.contraparte ? ` — ${v.contraparte}` : ""}
                    </td>
                    <td className="inicio-proximos-data">{formatarData(v.dataVencimento)}</td>
                    <td className="inicio-proximos-valor">{formatarValor(v.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="inicio-graficos-mensais">
        <BarraMensal
          titulo="Vistorias por mês"
          dados={vistoriasPorMes.map((m) => ({ rotulo: m.rotulo, valor: m.quantidade }))}
          cor="sequencial-1"
          formatarValor={(v) => String(v)}
        />
        <BarraMensal
          titulo="Faturamento de vistorias por mês"
          dados={vistoriasPorMes.map((m) => ({ rotulo: m.rotulo, valor: m.faturamento }))}
          cor="sequencial-2"
          formatarValor={formatarValor}
        />
        <BarraMensal
          titulo="Comparação de tipos de pagamento (mês atual)"
          dados={tiposPagamento.map((t) => ({ rotulo: t.tipo, valor: t.valor }))}
          cor="sequencial-3"
          formatarValor={formatarValor}
        />
      </div>

      <FluxoCaixaChart dados={fluxoCaixa} formatarValor={formatarValor} />
    </div>
  );
}

export default Inicio;
