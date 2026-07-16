import { Fragment, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  Search,
  X,
  Pencil,
  Trash2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ChevronDown,
  Banknote,
  Undo2,
} from "lucide-react";
import { listarVistorias, excluirVistoria, obterVistoria, Vistoria, STATUS_VISTORIA } from "../api/vistoria";
import { ParcelaContaReceber } from "../api/contaReceber";
import { ItemMenu } from "../api/menu";
import VistoriaForm from "./VistoriaForm";
import ContaReceberBaixaModal from "./ContaReceberBaixaModal";
import ContaReceberEstornoModal from "./ContaReceberEstornoModal";
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import "./ContaReceberForm.css";
import "./VistoriaPage.css";

type SubView = "lista" | "form";

const ITENS_POR_PAGINA = 15;

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "Código" },
  { chave: "emissao", label: "Emissão" },
  { chave: "placa", label: "Placa" },
  { chave: "cliente", label: "Cliente" },
  { chave: "cpfCnpj", label: "Cpf/Cnpj" },
  { chave: "responsavel", label: "Responsável" },
  { chave: "vistoriador", label: "Vistoriador" },
  { chave: "servico", label: "Serviço" },
  { chave: "total", label: "Total" },
  { chave: "tipoPagamento", label: "Tipo Pgto." },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = [
  "emissao",
  "placa",
  "cliente",
  "cpfCnpj",
  "responsavel",
  "servico",
  "total",
  "tipoPagamento",
  "status",
];

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(valor: string): string {
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function statusInfo(idStatus: number): { label: string; classe: string } {
  const item = STATUS_VISTORIA.find((s) => s.valor === idStatus);
  const classes: Record<number, string> = { 0: "pendente", 1: "pago", 2: "parcial", 3: "cancelado" };
  return { label: item?.label ?? "-", classe: classes[idStatus] ?? "pendente" };
}

function pad3(valor: number): string {
  return String(valor).padStart(3, "0");
}

function parcelaPaga(p: ParcelaContaReceber): boolean {
  return p.IdStatusParcela !== 0 || p.ValorPago > 0 || !!p.DataPagamento;
}

interface VistoriaPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
  voltarInicio: () => void;
}

function VistoriaPage({ permissoes, navegarPara, voltarInicio }: VistoriaPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeBaixarParcela = permissoes?.baixarParCR ?? false;
  const podeEstornarParcela = permissoes?.estornarParCR ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<number | "">("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("vistoria", COLUNAS_PADRAO)
  );

  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [parcelasPorVistoria, setParcelasPorVistoria] = useState<Record<number, ParcelaContaReceber[]>>({});
  const [carregandoParcelas, setCarregandoParcelas] = useState<Set<number>>(new Set());
  const [parcelaEmBaixa, setParcelaEmBaixa] = useState<{
    idVistoria: number;
    idContaReceber: number;
    parcela: ParcelaContaReceber;
  } | null>(null);
  const [parcelaEmEstorno, setParcelaEmEstorno] = useState<{
    idVistoria: number;
    idContaReceber: number;
    parcela: ParcelaContaReceber;
  } | null>(null);

  async function alternarExpandir(idVistoria: number) {
    const estavaExpandido = expandidos.has(idVistoria);
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (estavaExpandido) novo.delete(idVistoria);
      else novo.add(idVistoria);
      return novo;
    });

    if (estavaExpandido || parcelasPorVistoria[idVistoria]) return;

    setCarregandoParcelas((atual) => new Set(atual).add(idVistoria));
    try {
      const dados = await obterVistoria(idVistoria);
      setParcelasPorVistoria((atual) => ({ ...atual, [idVistoria]: dados.parcelas }));
    } finally {
      setCarregandoParcelas((atual) => {
        const novo = new Set(atual);
        novo.delete(idVistoria);
        return novo;
      });
    }
  }

  // Recarrega só a vistoria afetada (parcelas expandidas + status/saldo devedor do
  // cabeçalho na linha da lista) depois de uma baixa/estorno, sem recarregar a lista inteira.
  async function atualizarVistoriaLinha(idVistoria: number) {
    const dados = await obterVistoria(idVistoria);
    setParcelasPorVistoria((atual) => ({ ...atual, [idVistoria]: dados.parcelas }));
    setVistorias((atual) =>
      atual.map((v) =>
        v.idVistoria === idVistoria
          ? { ...v, idStatusVistoria: dados.idStatusVistoria, SaldoDevedor: dados.SaldoDevedor }
          : v
      )
    );
  }

  async function handleParcelaBaixada() {
    if (!parcelaEmBaixa) return;
    const { idVistoria } = parcelaEmBaixa;
    setParcelaEmBaixa(null);
    await atualizarVistoriaLinha(idVistoria);
  }

  async function handleParcelaEstornada() {
    if (!parcelaEmEstorno) return;
    const { idVistoria } = parcelaEmEstorno;
    setParcelaEmEstorno(null);
    await atualizarVistoriaLinha(idVistoria);
  }

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("vistoria", novo);
      return novo;
    });
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarVistorias(busca || undefined, status);
      setVistorias(dados);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (subView !== "lista") return;
    const timeout = setTimeout(() => {
      setPagina(1);
      carregar();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, status, subView]);

  async function handleExcluir(vistoria: Vistoria) {
    if (
      !window.confirm(
        `Excluir definitivamente a vistoria da placa "${vistoria.PlacaVeiculo}"? Isso não remove eventuais contas a receber/parcelas já geradas.`
      )
    )
      return;
    try {
      await excluirVistoria(vistoria.idVistoria);
      carregar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        window.alert(err.response.data?.erro || "Não foi possível excluir a vistoria");
      } else {
        window.alert("Não foi possível conectar ao servidor. Tente novamente.");
      }
    }
  }

  function abrirCriacao() {
    setIdSelecionado(null);
    setSubView("form");
  }

  function abrirEdicao(id: number) {
    setIdSelecionado(id);
    setSubView("form");
  }

  function voltarParaLista() {
    setSubView("lista");
    carregar();
  }

  if (subView === "form") {
    return (
      <VistoriaForm
        id={idSelecionado}
        onVoltar={voltarParaLista}
        navegarPara={navegarPara}
        permissoes={permissoes}
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(vistorias.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const vistoriasPagina = vistorias.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  return (
    <div className="vistoria-page">
      <div className="vistoria-toolbar">
        <button
          type="button"
          className="vistoria-btn-voltar"
          title="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="vistoria-busca">
          <Search size={16} />
          <input
            placeholder="Buscar por placa, cliente ou CPF/CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button type="button" className="vistoria-busca-limpar" title="Limpar busca" onClick={() => setBusca("")}>
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="vistoria-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Todos os status</option>
          {STATUS_VISTORIA.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="vistoria-toolbar-espaco" />

        {podeAdicionar && (
          <button className="vistoria-btn-criar" onClick={abrirCriacao}>
            Lançar Vistoria
          </button>
        )}
      </div>

      <div className="vistoria-tabela-wrapper">
        <table className="vistoria-tabela">
          <thead>
            <tr>
              <th className="vistoria-col-expandir"></th>
              {colunasVisiveis.has("id") && <th>Código</th>}
              {colunasVisiveis.has("emissao") && <th>Emissão</th>}
              {colunasVisiveis.has("placa") && <th>Placa</th>}
              {colunasVisiveis.has("cliente") && <th>Cliente</th>}
              {colunasVisiveis.has("cpfCnpj") && <th>Cpf/Cnpj</th>}
              {colunasVisiveis.has("responsavel") && <th>Responsável</th>}
              {colunasVisiveis.has("vistoriador") && <th>Vistoriador</th>}
              {colunasVisiveis.has("servico") && <th>Serviço</th>}
              {colunasVisiveis.has("total") && <th className="vistoria-col-valor">Total</th>}
              {colunasVisiveis.has("tipoPagamento") && <th>Tipo Pgto.</th>}
              {colunasVisiveis.has("status") && <th className="vistoria-col-status">Status</th>}
              <th className="vistoria-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="vistoria-vazio">
                  Carregando...
                </td>
              </tr>
            ) : vistoriasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="vistoria-vazio">
                  Nenhuma vistoria encontrada
                </td>
              </tr>
            ) : (
              vistoriasPagina.map((v) => {
                const { label, classe } = statusInfo(v.idStatusVistoria);
                const expandido = expandidos.has(v.idVistoria);
                const parcelas = parcelasPorVistoria[v.idVistoria];
                return (
                  <Fragment key={v.idVistoria}>
                    <tr className={expandido ? `vistoria-linha-pai-expandida vistoria-linha-pai-expandida-${classe}` : undefined}>
                      <td className="vistoria-col-expandir">
                        <button
                          type="button"
                          className={`vistoria-btn-expandir ${expandido ? "aberto" : ""}`}
                          title={expandido ? "Ocultar parcelas" : "Ver parcelas"}
                          onClick={() => alternarExpandir(v.idVistoria)}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </td>
                      {colunasVisiveis.has("id") && <td>{v.idVistoria}</td>}
                      {colunasVisiveis.has("emissao") && <td>{formatarData(v.DataEmissao)}</td>}
                      {colunasVisiveis.has("placa") && <td>{v.PlacaVeiculo}</td>}
                      {colunasVisiveis.has("cliente") && <td>{v.NomeCliente || "-"}</td>}
                      {colunasVisiveis.has("cpfCnpj") && <td>{v.CpfCnpj || "-"}</td>}
                      {colunasVisiveis.has("responsavel") && <td>{v.NomeResponsavel || "-"}</td>}
                      {colunasVisiveis.has("vistoriador") && <td>{v.NomeVistoriador || "-"}</td>}
                      {colunasVisiveis.has("servico") && <td>{v.DescricaoServico || "-"}</td>}
                      {colunasVisiveis.has("total") && (
                        <td className="vistoria-col-valor">{formatarValor(v.ValorTotalServico)}</td>
                      )}
                      {colunasVisiveis.has("tipoPagamento") && <td>{v.DescricaoTipoPagamento || "-"}</td>}
                      {colunasVisiveis.has("status") && (
                        <td className="vistoria-col-status">
                          <span className={`conta-receber-badge ${classe}`}>{label.toUpperCase()}</span>
                        </td>
                      )}
                      <td className="vistoria-col-acoes">
                        {podeEditar && (
                          <button
                            className="vistoria-icone-acao editar"
                            title="Editar"
                            onClick={() => abrirEdicao(v.idVistoria)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {podeExcluir && (
                          <button
                            className="vistoria-icone-acao perigo"
                            title={
                              v.idStatusVistoria === 1 || v.idStatusVistoria === 2
                                ? "Não é possível excluir: vistoria já paga ou parcial (regra do banco de dados)"
                                : "Excluir"
                            }
                            disabled={v.idStatusVistoria === 1 || v.idStatusVistoria === 2}
                            onClick={() => handleExcluir(v)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="vistoria-linha-expandida">
                        <td colSpan={colunasVisiveis.size + 2} className="vistoria-parcelas-celula">
                          {carregandoParcelas.has(v.idVistoria) ? (
                            <div className="vistoria-parcelas-estado">Carregando parcelas...</div>
                          ) : !parcelas || parcelas.length === 0 ? (
                            <div className="vistoria-parcelas-estado">Nenhuma parcela nesta vistoria.</div>
                          ) : (
                            <div className="conta-receber-form-parcelas-tabela-wrapper">
                              <table className="conta-receber-form-parcelas-tabela">
                                <thead>
                                  <tr>
                                    <th>Nº</th>
                                    <th>Vencimento</th>
                                    <th className="conta-receber-col-valor">Valor</th>
                                    <th className="conta-receber-col-valor">Pago</th>
                                    <th>Data Pagamento</th>
                                    <th>Tipo Pagamento</th>
                                    <th>Status</th>
                                    {(podeBaixarParcela || podeEstornarParcela) && (
                                      <th className="conta-receber-col-acoes">Ações</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {parcelas.map((p) => {
                                    const infoParcela = statusInfo(p.IdStatusParcela);
                                    const paga = parcelaPaga(p);
                                    return (
                                      <tr key={p.IdContaReceberParcela}>
                                        <td>{pad3(p.NumeroParcela)}</td>
                                        <td>{formatarData(p.DataVencimento)}</td>
                                        <td className="conta-receber-col-valor">{formatarValor(p.ValorParcela)}</td>
                                        <td className="conta-receber-col-valor">{formatarValor(p.ValorPago)}</td>
                                        <td>{p.DataPagamento ? formatarData(p.DataPagamento) : "-"}</td>
                                        <td>{p.DescricaoTipoPagamento || "-"}</td>
                                        <td>
                                          <span className={`conta-receber-badge ${infoParcela.classe}`}>
                                            {infoParcela.label.toUpperCase()}
                                          </span>
                                        </td>
                                        {(podeBaixarParcela || podeEstornarParcela) && (
                                          <td className="conta-receber-col-acoes">
                                            {podeBaixarParcela && !paga && v.idContaReceber && (
                                              <button
                                                type="button"
                                                className="conta-receber-icone-acao"
                                                title="Dar baixa nesta parcela"
                                                onClick={() =>
                                                  setParcelaEmBaixa({
                                                    idVistoria: v.idVistoria,
                                                    idContaReceber: v.idContaReceber as number,
                                                    parcela: p,
                                                  })
                                                }
                                              >
                                                <Banknote size={16} />
                                              </button>
                                            )}
                                            {podeEstornarParcela && paga && v.idContaReceber && (
                                              <button
                                                type="button"
                                                className="conta-receber-icone-acao estorno"
                                                title="Estornar a baixa desta parcela"
                                                onClick={() =>
                                                  setParcelaEmEstorno({
                                                    idVistoria: v.idVistoria,
                                                    idContaReceber: v.idContaReceber as number,
                                                    parcela: p,
                                                  })
                                                }
                                              >
                                                <Undo2 size={16} />
                                              </button>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="vistoria-rodape">
        <span>{vistorias.length} registros</span>
        <div className="vistoria-paginacao">
          <button disabled={paginaAtual === 1} onClick={() => setPagina(1)}>
            <ChevronsLeft size={16} />
          </button>
          <button disabled={paginaAtual === 1} onClick={() => setPagina((p) => p - 1)}>
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPaginas }, (_, i) => i + 1)
            .slice(Math.max(0, paginaAtual - 3), paginaAtual + 2)
            .map((p) => (
              <button key={p} className={p === paginaAtual ? "ativa" : ""} onClick={() => setPagina(p)}>
                {p}
              </button>
            ))}
          <button disabled={paginaAtual === totalPaginas} onClick={() => setPagina((p) => p + 1)}>
            <ChevronRight size={16} />
          </button>
          <button disabled={paginaAtual === totalPaginas} onClick={() => setPagina(totalPaginas)}>
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>

      {parcelaEmBaixa && (
        <ContaReceberBaixaModal
          idContaReceber={parcelaEmBaixa.idContaReceber}
          parcela={parcelaEmBaixa.parcela}
          onCancelar={() => setParcelaEmBaixa(null)}
          onBaixada={handleParcelaBaixada}
        />
      )}

      {parcelaEmEstorno && (
        <ContaReceberEstornoModal
          idContaReceber={parcelaEmEstorno.idContaReceber}
          parcela={parcelaEmEstorno.parcela}
          onCancelar={() => setParcelaEmEstorno(null)}
          onEstornada={handleParcelaEstornada}
        />
      )}
    </div>
  );
}

export default VistoriaPage;
