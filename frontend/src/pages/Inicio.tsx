import { useEffect, useState } from "react";
import { Wallet, ArrowUpCircle, ArrowDownCircle, ClipboardCheck, AlertTriangle, Clock, Printer } from "lucide-react";
import {
  buscarDashboard,
  buscarVistoriasPorVistoriadorDetalhado,
  buscarParcelasAlertasDetalhado,
  buscarContasAbertasDetalhado,
  Dashboard,
  TipoContaDashboard,
} from "../api/dashboard";
import BarraMensal from "../components/BarraMensal";
import FluxoCaixaChart from "../components/FluxoCaixaChart";
import RankingVistoriadores from "../components/RankingVistoriadores";
import { visualizarRelatorioVistoriadores } from "../utils/relatorioVistoriadores";
import { visualizarRelatorioParcelasAlertas } from "../utils/relatorioParcelas";
import { visualizarRelatorioContasAbertas } from "../utils/relatorioContasAbertas";
import { visualizarRelatorioVistoriasMes } from "../utils/relatorioVistoriasMes";
import { useToast } from "../contexts/ToastContext";
import "./Inicio.css";

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function mesReferenciaAtual(): string {
  const referencia = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return referencia.charAt(0).toUpperCase() + referencia.slice(1);
}

function Inicio() {
  const [dados, setDados] = useState<Dashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [imprimindoRelatorio, setImprimindoRelatorio] = useState(false);
  const [imprimindoRelatorioParcelas, setImprimindoRelatorioParcelas] = useState(false);
  const [imprimindoContaAberta, setImprimindoContaAberta] = useState<TipoContaDashboard | null>(null);
  const [imprimindoRelatorioVistoriasMes, setImprimindoRelatorioVistoriasMes] = useState(false);
  const { mostrarToast } = useToast();

  useEffect(() => {
    buscarDashboard()
      .then(setDados)
      .catch(() => setErro("Não foi possível carregar os dados do painel."))
      .finally(() => setCarregando(false));
  }, []);

  async function imprimirRelatorioVistoriadores() {
    setImprimindoRelatorio(true);
    try {
      const detalhado = await buscarVistoriasPorVistoriadorDetalhado();
      await visualizarRelatorioVistoriadores(detalhado, mesReferenciaAtual());
    } catch {
      mostrarToast("Não foi possível gerar o relatório de vistoriadores", "erro");
    } finally {
      setImprimindoRelatorio(false);
    }
  }

  async function imprimirRelatorioParcelas() {
    setImprimindoRelatorioParcelas(true);
    try {
      const detalhado = await buscarParcelasAlertasDetalhado();
      await visualizarRelatorioParcelasAlertas(detalhado);
    } catch {
      mostrarToast("Não foi possível gerar o relatório", "erro");
    } finally {
      setImprimindoRelatorioParcelas(false);
    }
  }

  async function imprimirRelatorioContasAbertas(tipo: TipoContaDashboard) {
    setImprimindoContaAberta(tipo);
    try {
      const detalhado = await buscarContasAbertasDetalhado(tipo);
      await visualizarRelatorioContasAbertas(detalhado, tipo);
    } catch {
      mostrarToast("Não foi possível gerar o relatório", "erro");
    } finally {
      setImprimindoContaAberta(null);
    }
  }

  async function imprimirRelatorioVistoriasMes() {
    setImprimindoRelatorioVistoriasMes(true);
    try {
      const detalhado = await buscarVistoriasPorVistoriadorDetalhado();
      await visualizarRelatorioVistoriasMes(detalhado, mesReferenciaAtual());
    } catch {
      mostrarToast("Não foi possível gerar o relatório de vistorias do mês", "erro");
    } finally {
      setImprimindoRelatorioVistoriasMes(false);
    }
  }

  if (carregando) {
    return <div className="inicio-pagina">Carregando painel...</div>;
  }

  if (erro || !dados) {
    return <div className="inicio-pagina inicio-erro">{erro || "Sem dados."}</div>;
  }

  const {
    caixa,
    aReceberAberto,
    aPagarAberto,
    vistoriasMes,
    alertas,
    fluxoCaixa,
    vistoriasPorMes,
    tiposPagamento,
    rankingVistoriadores,
  } = dados;

  const totalParcelasEmAlerta =
    alertas.vencidas.pagar.quantidade +
    alertas.vencidas.receber.quantidade +
    alertas.vencendoEm7Dias.pagar.quantidade +
    alertas.vencendoEm7Dias.receber.quantidade;

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
          <button
            type="button"
            className="inicio-kpi-btn-imprimir"
            onClick={() => imprimirRelatorioContasAbertas("receber")}
            disabled={imprimindoContaAberta === "receber" || aReceberAberto === 0}
            title={
              imprimindoContaAberta === "receber"
                ? "Gerando relatório..."
                : "Imprimir relatório de Contas a Receber em aberto"
            }
            aria-label="Imprimir relatório de Contas a Receber em aberto"
          >
            <Printer size={16} />
          </button>
        </div>

        <div className="inicio-kpi">
          <div className="inicio-kpi-icone inicio-kpi-icone-pagar">
            <ArrowDownCircle size={20} />
          </div>
          <div className="inicio-kpi-corpo">
            <span className="inicio-kpi-label">A Pagar em aberto</span>
            <span className="inicio-kpi-valor">{formatarValor(aPagarAberto)}</span>
          </div>
          <button
            type="button"
            className="inicio-kpi-btn-imprimir"
            onClick={() => imprimirRelatorioContasAbertas("pagar")}
            disabled={imprimindoContaAberta === "pagar" || aPagarAberto === 0}
            title={
              imprimindoContaAberta === "pagar" ? "Gerando relatório..." : "Imprimir relatório de Contas a Pagar em aberto"
            }
            aria-label="Imprimir relatório de Contas a Pagar em aberto"
          >
            <Printer size={16} />
          </button>
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
          <button
            type="button"
            className="inicio-kpi-btn-imprimir"
            onClick={imprimirRelatorioVistoriasMes}
            disabled={imprimindoRelatorioVistoriasMes || vistoriasMes.quantidade === 0}
            title={
              imprimindoRelatorioVistoriasMes ? "Gerando relatório..." : "Imprimir relatório de vistorias do mês"
            }
            aria-label="Imprimir relatório de vistorias do mês"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      <div className="inicio-alertas-vencimentos">
        <div className="inicio-alertas">
          <div className="inicio-alertas-cabecalho">
            <h3 className="inicio-alertas-titulo">Parcelas em aberto</h3>
            <button
              type="button"
              className="inicio-alertas-btn-imprimir"
              onClick={imprimirRelatorioParcelas}
              disabled={imprimindoRelatorioParcelas || totalParcelasEmAlerta === 0}
              title={imprimindoRelatorioParcelas ? "Gerando relatório..." : "Imprimir relatório de parcelas vencidas e a vencer"}
              aria-label="Imprimir relatório de parcelas vencidas e a vencer"
            >
              <Printer size={16} />
            </button>
          </div>
          <div className={`inicio-alerta inicio-alerta-critica ${alertas.vencidas.pagar.quantidade === 0 ? "inicio-alerta-vazia" : ""}`}>
            <AlertTriangle size={18} />
            <div>
              <strong>{alertas.vencidas.pagar.quantidade}</strong> parcela(s) vencida(s) <span className="inicio-alerta-tag">Pagar</span>
              <span className="inicio-alerta-valor">{formatarValor(alertas.vencidas.pagar.valor)}</span>
            </div>
          </div>
          <div className={`inicio-alerta inicio-alerta-critica ${alertas.vencidas.receber.quantidade === 0 ? "inicio-alerta-vazia" : ""}`}>
            <AlertTriangle size={18} />
            <div>
              <strong>{alertas.vencidas.receber.quantidade}</strong> parcela(s) vencida(s) <span className="inicio-alerta-tag">Receber</span>
              <span className="inicio-alerta-valor">{formatarValor(alertas.vencidas.receber.valor)}</span>
            </div>
          </div>
          <div className={`inicio-alerta inicio-alerta-aviso ${alertas.vencendoEm7Dias.pagar.quantidade === 0 ? "inicio-alerta-vazia" : ""}`}>
            <Clock size={18} />
            <div>
              <div className="inicio-alerta-linha">
                <strong>{alertas.vencendoEm7Dias.pagar.quantidade}</strong> vencendo em 7 dias{" "}
                <span className="inicio-alerta-tag">Pagar</span>
              </div>
              <span className="inicio-alerta-valor">{formatarValor(alertas.vencendoEm7Dias.pagar.valor)}</span>
            </div>
          </div>
          <div className={`inicio-alerta inicio-alerta-aviso ${alertas.vencendoEm7Dias.receber.quantidade === 0 ? "inicio-alerta-vazia" : ""}`}>
            <Clock size={18} />
            <div>
              <div className="inicio-alerta-linha">
                <strong>{alertas.vencendoEm7Dias.receber.quantidade}</strong> vencendo em 7 dias{" "}
                <span className="inicio-alerta-tag">Receber</span>
              </div>
              <span className="inicio-alerta-valor">{formatarValor(alertas.vencendoEm7Dias.receber.valor)}</span>
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
        <RankingVistoriadores
          dados={rankingVistoriadores}
          formatarValor={formatarValor}
          aoImprimirRelatorio={imprimirRelatorioVistoriadores}
          imprimindoRelatorio={imprimindoRelatorio}
        />
      </div>

      <FluxoCaixaChart dados={fluxoCaixa} formatarValor={formatarValor} />
    </div>
  );
}

export default Inicio;
