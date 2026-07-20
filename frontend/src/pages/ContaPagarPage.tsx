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
import {
  listarContasPagar,
  excluirContaPagar,
  obterContaPagar,
  ContaPagar,
  ParcelaContaPagar,
  STATUS_CONTA_PAGAR,
} from "../api/contaPagar";
import { ItemMenu } from "../api/menu";
import ContaPagarForm from "./ContaPagarForm";
import ContaPagarBaixaModal from "./ContaPagarBaixaModal";
import ContaPagarEstornoModal from "./ContaPagarEstornoModal";
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import ThOrdenavel from "../components/ThOrdenavel";
import BotaoExportar from "../components/BotaoExportar";
import SeletorItensPorPagina from "../components/SeletorItensPorPagina";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import { obterItensPorPagina, salvarItensPorPagina } from "../utils/itensPorPagina";
import { useOrdenacao, ordenarLista } from "../utils/ordenacao";
import { colunasVisiveisParaExportacao } from "../utils/exportarCsv";
import { useToast } from "../contexts/ToastContext";
import { useConfirmacao } from "../contexts/ConfirmContext";
import "./ContaPagarForm.css";
import "./ContaPagarPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "numeroDocumento", label: "Documento" },
  { chave: "descricao", label: "Descrição" },
  { chave: "fornecedor", label: "Fornecedor" },
  { chave: "categoria", label: "Categoria" },
  { chave: "valorTotal", label: "Valor Total" },
  { chave: "saldoDevedor", label: "Saldo Devedor" },
  { chave: "dataEmissao", label: "Emissão" },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = [
  "descricao",
  "fornecedor",
  "categoria",
  "valorTotal",
  "saldoDevedor",
  "dataEmissao",
  "status",
];

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(valor: string): string {
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function statusInfo(idStatus: number): { label: string; classe: string } {
  const item = STATUS_CONTA_PAGAR.find((s) => s.valor === idStatus);
  const classes: Record<number, string> = { 0: "pendente", 1: "pago", 2: "parcial", 3: "cancelado" };
  return { label: item?.label ?? "-", classe: classes[idStatus] ?? "pendente" };
}

function pad3(valor: number): string {
  return String(valor).padStart(3, "0");
}

function parcelaPaga(p: ParcelaContaPagar): boolean {
  return p.IdStatusParcela !== 0 || p.ValorPago > 0 || !!p.DataPagamento;
}

function classeVencimento(dataVencimento: string, paga: boolean): string {
  if (paga) return "";
  const venc = dataVencimento.slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);
  if (venc < hoje) return "conta-pagar-vencimento-vencida";
  if (venc === hoje) return "conta-pagar-vencimento-hoje";
  return "";
}

function parcelaEstornada(p: ParcelaContaPagar): boolean {
  return !!p.Observacao?.startsWith("[Estorno");
}

interface ContaPagarPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
  voltarInicio: () => void;
}

function ContaPagarPage({ permissoes, navegarPara, voltarInicio }: ContaPagarPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeBaixarParcela = permissoes?.baixarParCP ?? false;
  const podeEstornarParcela = permissoes?.estornarParCP ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<number | "">("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("conta-pagar", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("conta-pagar"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [parcelasPorConta, setParcelasPorConta] = useState<Record<number, ParcelaContaPagar[]>>({});
  const [carregandoParcelas, setCarregandoParcelas] = useState<Set<number>>(new Set());
  const [parcelaEmBaixa, setParcelaEmBaixa] = useState<{ idContaPagar: number; parcela: ParcelaContaPagar } | null>(
    null
  );
  const [parcelaEmEstorno, setParcelaEmEstorno] = useState<{
    idContaPagar: number;
    parcela: ParcelaContaPagar;
  } | null>(null);

  async function alternarExpandir(idContaPagar: number) {
    const estavaExpandido = expandidos.has(idContaPagar);
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (estavaExpandido) novo.delete(idContaPagar);
      else novo.add(idContaPagar);
      return novo;
    });

    if (estavaExpandido || parcelasPorConta[idContaPagar]) return;

    setCarregandoParcelas((atual) => new Set(atual).add(idContaPagar));
    try {
      const dados = await obterContaPagar(idContaPagar);
      setParcelasPorConta((atual) => ({ ...atual, [idContaPagar]: dados.parcelas }));
    } finally {
      setCarregandoParcelas((atual) => {
        const novo = new Set(atual);
        novo.delete(idContaPagar);
        return novo;
      });
    }
  }

  // Recarrega só a conta afetada (parcelas expandidas + status/saldo devedor do cabeçalho na
  // linha da lista) depois de uma baixa/estorno, sem precisar recarregar a lista inteira.
  async function atualizarConta(idContaPagar: number) {
    const dados = await obterContaPagar(idContaPagar);
    setParcelasPorConta((atual) => ({ ...atual, [idContaPagar]: dados.parcelas }));
    setContas((atual) =>
      atual.map((c) =>
        c.idContaPagar === idContaPagar
          ? {
              ...c,
              IdStatusContaPagar: dados.IdStatusContaPagar,
              SaldoDevedor: dados.SaldoDevedor,
              ParcelasVencidas: dados.ParcelasVencidas,
              ParcelasVencendoHoje: dados.ParcelasVencendoHoje,
            }
          : c
      )
    );
  }

  async function handleParcelaBaixada() {
    if (!parcelaEmBaixa) return;
    const { idContaPagar } = parcelaEmBaixa;
    setParcelaEmBaixa(null);
    await atualizarConta(idContaPagar);
  }

  async function handleParcelaEstornada() {
    if (!parcelaEmEstorno) return;
    const { idContaPagar } = parcelaEmEstorno;
    setParcelaEmEstorno(null);
    await atualizarConta(idContaPagar);
  }

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("conta-pagar", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("conta-pagar", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarContasPagar(busca || undefined, status);
      setContas(dados);
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

  async function handleExcluir(conta: ContaPagar) {
    if (
      !(await confirmar({
        mensagem: `Excluir definitivamente a conta "${conta.Descricao}"? Isso remove também todas as parcelas ainda pendentes.`,
        perigo: true,
      }))
    )
      return;
    try {
      await excluirContaPagar(conta.idContaPagar);
      carregar();
      mostrarToast("Conta a pagar excluída com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir a conta a pagar", "erro");
      } else {
        mostrarToast("Não foi possível conectar ao servidor. Tente novamente.", "erro");
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
      <ContaPagarForm
        id={idSelecionado}
        onVoltar={voltarParaLista}
        navegarPara={navegarPara}
        permissoes={permissoes}
      />
    );
  }

  const contasOrdenadas = ordenarLista(contas, ordenacao, {
    id: (c) => c.idContaPagar,
    numeroDocumento: (c) => c.NumeroDocumento || "",
    descricao: (c) => c.Descricao,
    fornecedor: (c) => c.RazaoSocial || "",
    categoria: (c) => c.DescricaoCategoria,
    valorTotal: (c) => c.ValorTotal,
    saldoDevedor: (c) => c.SaldoDevedor,
    dataEmissao: (c) => c.DataEmissao,
    status: (c) => c.IdStatusContaPagar,
  });
  const colunasExportacao = colunasVisiveisParaExportacao<ContaPagar>(COLUNAS, colunasVisiveis, {
    id: (c) => String(c.idContaPagar),
    numeroDocumento: (c) => c.NumeroDocumento || "-",
    descricao: (c) => c.Descricao,
    fornecedor: (c) => c.RazaoSocial || "-",
    categoria: (c) => c.DescricaoCategoria,
    valorTotal: (c) => formatarValor(c.ValorTotal),
    saldoDevedor: (c) => formatarValor(c.SaldoDevedor),
    dataEmissao: (c) => formatarData(c.DataEmissao),
    status: (c) => statusInfo(c.IdStatusContaPagar).label.toUpperCase(),
  });

  const totalPaginas = Math.max(1, Math.ceil(contasOrdenadas.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const contasPagina = contasOrdenadas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="conta-pagar-page">
      <div className="conta-pagar-toolbar">
        <button
          type="button"
          className="conta-pagar-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="conta-pagar-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="conta-pagar-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="conta-pagar-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Todos os status</option>
          {STATUS_CONTA_PAGAR.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="conta-pagar-toolbar-espaco" />

        <div className="conta-pagar-toolbar-direita">
          <div className="conta-pagar-legenda">
            <span className="conta-pagar-legenda-item">
              <span className="conta-pagar-legenda-cor vencida" /> parcela(s) vencida(s)
            </span>
            <span className="conta-pagar-legenda-item">
              <span className="conta-pagar-legenda-cor vencendo-hoje" /> parcela vencendo hoje
            </span>
            <span className="conta-pagar-legenda-item">
              <span className="conta-pagar-legenda-cor estornada" /> Parcela Estornada
            </span>
          </div>

          {podeExportar && (
            <BotaoExportar
              nomeArquivo="contas-a-pagar"
              titulo="Contas a Pagar"
              dados={contasOrdenadas}
              colunas={colunasExportacao}
            />
          )}

          {podeAdicionar && (
            <button className="conta-pagar-btn-criar" onClick={abrirCriacao}>
              Criar Conta a Pagar
            </button>
          )}
        </div>
      </div>

      <div className={`conta-pagar-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="conta-pagar-tabela">
          <thead>
            <tr>
              <th className="conta-pagar-col-expandir"></th>
              {colunasVisiveis.has("id") && (
                <ThOrdenavel campo="id" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  ID
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("numeroDocumento") && (
                <ThOrdenavel campo="numeroDocumento" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Documento
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("descricao") && (
                <ThOrdenavel campo="descricao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Descrição
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("fornecedor") && (
                <ThOrdenavel campo="fornecedor" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Fornecedor
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("categoria") && (
                <ThOrdenavel campo="categoria" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Categoria
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("valorTotal") && (
                <ThOrdenavel
                  campo="valorTotal"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="conta-pagar-col-valor"
                >
                  Valor Total
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("saldoDevedor") && (
                <ThOrdenavel
                  campo="saldoDevedor"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="conta-pagar-col-valor"
                >
                  Saldo Devedor
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("dataEmissao") && (
                <ThOrdenavel campo="dataEmissao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Emissão
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("status") && (
                <ThOrdenavel
                  campo="status"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="conta-pagar-col-status"
                >
                  Status
                </ThOrdenavel>
              )}
              <th className="conta-pagar-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && contasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="conta-pagar-vazio">Carregando...</td>
              </tr>
            ) : contasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="conta-pagar-vazio">
                  Nenhuma conta a pagar encontrada
                </td>
              </tr>
            ) : (
              contasPagina.map((c) => {
                const { label, classe } = statusInfo(c.IdStatusContaPagar);
                const expandido = expandidos.has(c.idContaPagar);
                const parcelas = parcelasPorConta[c.idContaPagar];
                return (
                  <Fragment key={c.idContaPagar}>
                  <tr className={expandido ? `conta-pagar-linha-pai-expandida conta-pagar-linha-pai-expandida-${classe}` : undefined}>
                    <td className="conta-pagar-col-expandir">
                      <button
                        type="button"
                        className={`conta-pagar-btn-expandir ${expandido ? "aberto" : ""}`}
                        title={expandido ? "Ocultar parcelas" : "Ver parcelas"}
                        aria-label={expandido ? "Ocultar parcelas" : "Ver parcelas"}
                        onClick={() => alternarExpandir(c.idContaPagar)}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </td>
                    {colunasVisiveis.has("id") && <td>{c.idContaPagar}</td>}
                    {colunasVisiveis.has("numeroDocumento") && <td>{c.NumeroDocumento || "-"}</td>}
                    {colunasVisiveis.has("descricao") && <td>{c.Descricao}</td>}
                    {colunasVisiveis.has("fornecedor") && <td>{c.RazaoSocial || "-"}</td>}
                    {colunasVisiveis.has("categoria") && <td>{c.DescricaoCategoria}</td>}
                    {colunasVisiveis.has("valorTotal") && (
                      <td className="conta-pagar-col-valor">{formatarValor(c.ValorTotal)}</td>
                    )}
                    {colunasVisiveis.has("saldoDevedor") && (
                      <td className="conta-pagar-col-valor">{formatarValor(c.SaldoDevedor)}</td>
                    )}
                    {colunasVisiveis.has("dataEmissao") && <td>{formatarData(c.DataEmissao)}</td>}
                    {colunasVisiveis.has("status") && (
                      <td className="conta-pagar-col-status">
                        <span className={`conta-pagar-badge ${classe}`}>{label.toUpperCase()}</span>
                        {c.ParcelasVencidas > 0 && (
                          <span
                            className="conta-pagar-badge-vencidas"
                            title={`${c.ParcelasVencidas} parcela(s) vencida(s)`}
                          />
                        )}
                        {c.ParcelasVencendoHoje > 0 && (
                          <span
                            className="conta-pagar-badge-vencendo-hoje"
                            title="Parcela vencendo hoje"
                          />
                        )}
                      </td>
                    )}
                    <td className="conta-pagar-col-acoes">
                      {podeEditar && (
                        <button
                          className="conta-pagar-icone-acao editar"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => abrirEdicao(c.idContaPagar)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="conta-pagar-icone-acao perigo"
                          title={
                            c.IdStatusContaPagar === 1 || c.IdStatusContaPagar === 2
                              ? "Não é possível excluir: existe parcela já paga ou baixada nesta conta"
                              : "Excluir"
                          }
                          aria-label={
                            c.IdStatusContaPagar === 1 || c.IdStatusContaPagar === 2
                              ? "Não é possível excluir: existe parcela já paga ou baixada nesta conta"
                              : "Excluir"
                          }
                          disabled={c.IdStatusContaPagar === 1 || c.IdStatusContaPagar === 2}
                          onClick={() => handleExcluir(c)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandido && (
                    <tr className="conta-pagar-linha-expandida">
                      <td colSpan={colunasVisiveis.size + 2} className="conta-pagar-parcelas-celula">
                        {carregandoParcelas.has(c.idContaPagar) ? (
                          <div className="conta-pagar-parcelas-estado">Carregando parcelas...</div>
                        ) : !parcelas || parcelas.length === 0 ? (
                          <div className="conta-pagar-parcelas-estado">Nenhuma parcela nesta conta.</div>
                        ) : (
                          <div className="conta-pagar-form-parcelas-tabela-wrapper">
                            <table className="conta-pagar-form-parcelas-tabela">
                              <thead>
                                <tr>
                                  <th>Nº</th>
                                  <th>Cód. Parcela</th>
                                  <th>Vencimento</th>
                                  <th className="conta-pagar-col-valor">Valor</th>
                                  <th className="conta-pagar-col-valor">Pago</th>
                                  <th>Data Pagamento</th>
                                  <th>Tipo Pagamento</th>
                                  <th>Status</th>
                                  {(podeBaixarParcela || podeEstornarParcela) && (
                                    <th className="conta-pagar-col-acoes">Ações</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {parcelas.map((p) => {
                                  const infoParcela = statusInfo(p.IdStatusParcela);
                                  const paga = parcelaPaga(p);
                                  return (
                                    <tr key={p.IdContaPagarParcela}>
                                      <td>{pad3(p.NumeroParcela)}</td>
                                      <td>{p.IdContaPagarParcela}</td>
                                      <td className={classeVencimento(p.DataVencimento, paga)}>
                                        {formatarData(p.DataVencimento)}
                                      </td>
                                      <td className="conta-pagar-col-valor">{formatarValor(p.ValorParcela)}</td>
                                      <td className="conta-pagar-col-valor">{formatarValor(p.ValorPago)}</td>
                                      <td>{p.DataPagamento ? formatarData(p.DataPagamento) : "-"}</td>
                                      <td>{p.DescricaoTipoPagamento || "-"}</td>
                                      <td>
                                        <span className={`conta-pagar-badge ${infoParcela.classe}`}>
                                          {infoParcela.label.toUpperCase()}
                                        </span>
                                        {parcelaEstornada(p) && (
                                          <span className="conta-pagar-badge-estornada" title="Parcela estornada" />
                                        )}
                                      </td>
                                      {(podeBaixarParcela || podeEstornarParcela) && (
                                        <td className="conta-pagar-col-acoes">
                                          {podeBaixarParcela && !paga && (
                                            <button
                                              type="button"
                                              className="conta-pagar-icone-acao"
                                              title="Dar baixa nesta parcela"
                                              aria-label="Dar baixa nesta parcela"
                                              onClick={() =>
                                                setParcelaEmBaixa({ idContaPagar: c.idContaPagar, parcela: p })
                                              }
                                            >
                                              <Banknote size={16} />
                                            </button>
                                          )}
                                          {podeEstornarParcela && paga && (
                                            <button
                                              type="button"
                                              className="conta-pagar-icone-acao estorno"
                                              title="Estornar a baixa desta parcela"
                                              aria-label="Estornar a baixa desta parcela"
                                              onClick={() =>
                                                setParcelaEmEstorno({ idContaPagar: c.idContaPagar, parcela: p })
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

      <div className="conta-pagar-rodape">
        <span>{contas.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="conta-pagar-paginacao">
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
        <ContaPagarBaixaModal
          idContaPagar={parcelaEmBaixa.idContaPagar}
          parcela={parcelaEmBaixa.parcela}
          onCancelar={() => setParcelaEmBaixa(null)}
          onBaixada={handleParcelaBaixada}
        />
      )}

      {parcelaEmEstorno && (
        <ContaPagarEstornoModal
          idContaPagar={parcelaEmEstorno.idContaPagar}
          parcela={parcelaEmEstorno.parcela}
          onCancelar={() => setParcelaEmEstorno(null)}
          onEstornada={handleParcelaEstornada}
        />
      )}
    </div>
  );
}

export default ContaPagarPage;
