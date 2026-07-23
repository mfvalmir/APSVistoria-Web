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
  Eye,
} from "lucide-react";
import {
  listarContasReceber,
  excluirContaReceber,
  obterContaReceber,
  ContaReceber,
  ParcelaContaReceber,
  STATUS_CONTA_RECEBER,
} from "../api/contaReceber";
import { obterCliente } from "../api/clientes";
import { ItemMenu } from "../api/menu";
import ContaReceberForm from "./ContaReceberForm";
import ContaReceberBaixaModal from "./ContaReceberBaixaModal";
import ContaReceberEstornoModal from "./ContaReceberEstornoModal";
import { visualizarRecibo, ReciboValorZeroError } from "../utils/recibo";
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
import "./ContaReceberForm.css";
import "./ContaReceberPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "numeroDocumento", label: "Documento" },
  { chave: "descricao", label: "Descrição" },
  { chave: "cliente", label: "Cliente" },
  { chave: "categoria", label: "Categoria" },
  { chave: "valorTotal", label: "Valor Total" },
  { chave: "saldoDevedor", label: "Saldo Devedor" },
  { chave: "dataEmissao", label: "Emissão" },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = [
  "descricao",
  "cliente",
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
  const item = STATUS_CONTA_RECEBER.find((s) => s.valor === idStatus);
  const classes: Record<number, string> = { 0: "pendente", 1: "pago", 2: "parcial", 3: "cancelado" };
  return { label: item?.label ?? "-", classe: classes[idStatus] ?? "pendente" };
}

function pad3(valor: number): string {
  return String(valor).padStart(3, "0");
}

function parcelaPaga(p: ParcelaContaReceber): boolean {
  return p.IdStatusParcela !== 0 || p.ValorPago > 0 || !!p.DataPagamento;
}

function classeVencimento(dataVencimento: string, paga: boolean): string {
  if (paga) return "";
  const venc = dataVencimento.slice(0, 10);
  const hojeStr = new Date().toISOString().slice(0, 10);
  if (venc < hojeStr) return "conta-receber-vencimento-vencida";
  if (venc === hojeStr) return "conta-receber-vencimento-hoje";
  return "";
}

function parcelaEstornada(p: ParcelaContaReceber): boolean {
  return !!p.Observacao?.startsWith("[Estorno");
}

interface ContaReceberPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
  voltarInicio: () => void;
}

function ContaReceberPage({ permissoes, navegarPara, voltarInicio }: ContaReceberPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeBaixarParcela = permissoes?.baixarParCR ?? false;
  const podeEstornarParcela = permissoes?.estornarParCR ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<number | "">("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("conta-receber", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("conta-receber"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [parcelasPorConta, setParcelasPorConta] = useState<Record<number, ParcelaContaReceber[]>>({});
  const [carregandoParcelas, setCarregandoParcelas] = useState<Set<number>>(new Set());
  const [parcelaEmBaixa, setParcelaEmBaixa] = useState<{
    idContaReceber: number;
    parcela: ParcelaContaReceber;
  } | null>(null);
  const [parcelaEmEstorno, setParcelaEmEstorno] = useState<{
    idContaReceber: number;
    parcela: ParcelaContaReceber;
  } | null>(null);
  const [gerandoRecibo, setGerandoRecibo] = useState<number | null>(null);

  async function alternarExpandir(idContaReceber: number) {
    const estavaExpandido = expandidos.has(idContaReceber);
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (estavaExpandido) novo.delete(idContaReceber);
      else novo.add(idContaReceber);
      return novo;
    });

    if (estavaExpandido || parcelasPorConta[idContaReceber]) return;

    setCarregandoParcelas((atual) => new Set(atual).add(idContaReceber));
    try {
      const dados = await obterContaReceber(idContaReceber);
      setParcelasPorConta((atual) => ({ ...atual, [idContaReceber]: dados.parcelas }));
    } finally {
      setCarregandoParcelas((atual) => {
        const novo = new Set(atual);
        novo.delete(idContaReceber);
        return novo;
      });
    }
  }

  // Recarrega só a conta afetada (parcelas expandidas + status/saldo devedor do cabeçalho na
  // linha da lista) depois de uma baixa/estorno, sem precisar recarregar a lista inteira.
  async function atualizarConta(idContaReceber: number) {
    const dados = await obterContaReceber(idContaReceber);
    setParcelasPorConta((atual) => ({ ...atual, [idContaReceber]: dados.parcelas }));
    setContas((atual) =>
      atual.map((c) =>
        c.IdContaReceber === idContaReceber
          ? {
              ...c,
              IdStatusContaReceber: dados.IdStatusContaReceber,
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
    const { idContaReceber } = parcelaEmBaixa;
    setParcelaEmBaixa(null);
    await atualizarConta(idContaReceber);
  }

  async function handleParcelaEstornada() {
    if (!parcelaEmEstorno) return;
    const { idContaReceber } = parcelaEmEstorno;
    setParcelaEmEstorno(null);
    await atualizarConta(idContaReceber);
  }

  async function emitirRecibo(c: ContaReceber, p: ParcelaContaReceber) {
    setGerandoRecibo(p.IdContaReceberParcela);
    try {
      let documentoPagador: string | null = null;
      if (c.idCliente) {
        try {
          const cliente = await obterCliente(c.idCliente);
          documentoPagador = cliente.CpfCnpj || null;
        } catch {
          documentoPagador = null;
        }
      }
      const parcelasDaConta = parcelasPorConta[c.IdContaReceber] || [];
      await visualizarRecibo({
        numeroRecibo: `${c.IdContaReceber}-${pad3(p.NumeroParcela)}`,
        nomePagador: c.NomeCliente?.trim() || "Cliente não identificado",
        documentoPagador,
        valor: p.ValorPago || p.ValorParcela,
        dataPagamento: p.DataPagamento || new Date().toISOString(),
        formaPagamento: p.DescricaoTipoPagamento || "-",
        referente: `à parcela nº ${pad3(p.NumeroParcela)}/${pad3(parcelasDaConta.length)} da Conta a Receber nº ${
          c.IdContaReceber
        }${c.Descricao ? ` (${c.Descricao})` : ""}`,
        observacao: p.Observacao,
      });
    } catch (err) {
      if (err instanceof ReciboValorZeroError) {
        await confirmar({ titulo: "Recibo não gerado", mensagem: err.message, apenasOk: true });
      } else {
        mostrarToast("Não foi possível gerar o recibo", "erro");
      }
    } finally {
      setGerandoRecibo(null);
    }
  }

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("conta-receber", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("conta-receber", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarContasReceber(busca || undefined, status);
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

  async function handleExcluir(conta: ContaReceber) {
    if (
      !(await confirmar({
        mensagem: `Excluir definitivamente a conta "${conta.Descricao}"? Isso remove também todas as parcelas ainda pendentes.`,
        perigo: true,
      }))
    )
      return;
    try {
      await excluirContaReceber(conta.IdContaReceber);
      carregar();
      mostrarToast("Conta a receber excluída com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir a conta a receber", "erro");
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
      <ContaReceberForm
        id={idSelecionado}
        onVoltar={voltarParaLista}
        navegarPara={navegarPara}
        permissoes={permissoes}
      />
    );
  }

  const contasOrdenadas = ordenarLista(contas, ordenacao, {
    id: (c) => c.IdContaReceber,
    numeroDocumento: (c) => c.NumeroDocumento || "",
    descricao: (c) => c.Descricao,
    cliente: (c) => c.NomeCliente || "",
    categoria: (c) => c.DescricaoCategoria,
    valorTotal: (c) => c.ValorTotal,
    saldoDevedor: (c) => c.SaldoDevedor,
    dataEmissao: (c) => c.DataEmissao,
    status: (c) => c.IdStatusContaReceber,
  });
  const colunasExportacao = colunasVisiveisParaExportacao<ContaReceber>(COLUNAS, colunasVisiveis, {
    id: (c) => String(c.IdContaReceber),
    numeroDocumento: (c) => c.NumeroDocumento || "-",
    descricao: (c) => c.Descricao,
    cliente: (c) => c.NomeCliente || "-",
    categoria: (c) => c.DescricaoCategoria,
    valorTotal: (c) => formatarValor(c.ValorTotal),
    saldoDevedor: (c) => formatarValor(c.SaldoDevedor),
    dataEmissao: (c) => formatarData(c.DataEmissao),
    status: (c) => statusInfo(c.IdStatusContaReceber).label.toUpperCase(),
  });

  const totalPaginas = Math.max(1, Math.ceil(contasOrdenadas.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const contasPagina = contasOrdenadas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="conta-receber-page">
      <div className="conta-receber-toolbar">
        <button
          type="button"
          className="conta-receber-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="conta-receber-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="conta-receber-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="conta-receber-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Todos os status</option>
          {STATUS_CONTA_RECEBER.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="conta-receber-toolbar-espaco" />

        <div className="conta-receber-toolbar-direita">
          <div className="conta-receber-legenda">
            <span className="conta-receber-legenda-item">
              <span className="conta-receber-legenda-cor vencida" /> parcela(s) vencida(s)
            </span>
            <span className="conta-receber-legenda-item">
              <span className="conta-receber-legenda-cor vencendo-hoje" /> parcela vencendo hoje
            </span>
            <span className="conta-receber-legenda-item">
              <span className="conta-receber-legenda-cor estornada" /> Parcela Estornada
            </span>
          </div>

          {podeExportar && (
            <BotaoExportar
              nomeArquivo="contas-a-receber"
              titulo="Contas a Receber"
              dados={contasOrdenadas}
              colunas={colunasExportacao}
            />
          )}

          {podeAdicionar && (
            <button className="conta-receber-btn-criar" onClick={abrirCriacao}>
              Criar Conta a Receber
            </button>
          )}
        </div>
      </div>

      <div className={`conta-receber-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="conta-receber-tabela">
          <thead>
            <tr>
              <th className="conta-receber-col-expandir"></th>
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
              {colunasVisiveis.has("cliente") && (
                <ThOrdenavel campo="cliente" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Cliente
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
                  className="conta-receber-col-valor"
                >
                  Valor Total
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("saldoDevedor") && (
                <ThOrdenavel
                  campo="saldoDevedor"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="conta-receber-col-valor"
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
                  className="conta-receber-col-status"
                >
                  Status
                </ThOrdenavel>
              )}
              <th className="conta-receber-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && contasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="conta-receber-vazio">Carregando...</td>
              </tr>
            ) : contasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="conta-receber-vazio">
                  Nenhuma conta a receber encontrada
                </td>
              </tr>
            ) : (
              contasPagina.map((c) => {
                const { label, classe } = statusInfo(c.IdStatusContaReceber);
                const expandido = expandidos.has(c.IdContaReceber);
                const parcelas = parcelasPorConta[c.IdContaReceber];
                return (
                  <Fragment key={c.IdContaReceber}>
                  <tr className={expandido ? `conta-receber-linha-pai-expandida conta-receber-linha-pai-expandida-${classe}` : undefined}>
                    <td className="conta-receber-col-expandir">
                      <button
                        type="button"
                        className={`conta-receber-btn-expandir ${expandido ? "aberto" : ""}`}
                        title={expandido ? "Ocultar parcelas" : "Ver parcelas"}
                        aria-label={expandido ? "Ocultar parcelas" : "Ver parcelas"}
                        onClick={() => alternarExpandir(c.IdContaReceber)}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </td>
                    {colunasVisiveis.has("id") && <td>{c.IdContaReceber}</td>}
                    {colunasVisiveis.has("numeroDocumento") && <td>{c.NumeroDocumento || "-"}</td>}
                    {colunasVisiveis.has("descricao") && <td>{c.Descricao}</td>}
                    {colunasVisiveis.has("cliente") && <td>{c.NomeCliente || "-"}</td>}
                    {colunasVisiveis.has("categoria") && <td>{c.DescricaoCategoria}</td>}
                    {colunasVisiveis.has("valorTotal") && (
                      <td className="conta-receber-col-valor">{formatarValor(c.ValorTotal)}</td>
                    )}
                    {colunasVisiveis.has("saldoDevedor") && (
                      <td className="conta-receber-col-valor">{formatarValor(c.SaldoDevedor)}</td>
                    )}
                    {colunasVisiveis.has("dataEmissao") && <td>{formatarData(c.DataEmissao)}</td>}
                    {colunasVisiveis.has("status") && (
                      <td className="conta-receber-col-status">
                        <span className={`conta-receber-badge ${classe}`}>{label.toUpperCase()}</span>
                        {c.ParcelasVencidas > 0 && (
                          <span
                            className="conta-receber-badge-vencidas"
                            title={`${c.ParcelasVencidas} parcela(s) vencida(s)`}
                          />
                        )}
                        {c.ParcelasVencendoHoje > 0 && (
                          <span
                            className="conta-receber-badge-vencendo-hoje"
                            title="Parcela vencendo hoje"
                          />
                        )}
                      </td>
                    )}
                    <td className="conta-receber-col-acoes">
                      {podeEditar && (
                        <button
                          className="conta-receber-icone-acao editar"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => abrirEdicao(c.IdContaReceber)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="conta-receber-icone-acao perigo"
                          title={
                            c.IdStatusContaReceber === 1 || c.IdStatusContaReceber === 2
                              ? "Não é possível excluir: existe parcela já paga ou baixada nesta conta"
                              : "Excluir"
                          }
                          aria-label={
                            c.IdStatusContaReceber === 1 || c.IdStatusContaReceber === 2
                              ? "Não é possível excluir: existe parcela já paga ou baixada nesta conta"
                              : "Excluir"
                          }
                          disabled={c.IdStatusContaReceber === 1 || c.IdStatusContaReceber === 2}
                          onClick={() => handleExcluir(c)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandido && (
                    <tr className="conta-receber-linha-expandida">
                      <td colSpan={colunasVisiveis.size + 2} className="conta-receber-parcelas-celula">
                        {carregandoParcelas.has(c.IdContaReceber) ? (
                          <div className="conta-receber-parcelas-estado">Carregando parcelas...</div>
                        ) : !parcelas || parcelas.length === 0 ? (
                          <div className="conta-receber-parcelas-estado">Nenhuma parcela nesta conta.</div>
                        ) : (
                          <div className="conta-receber-form-parcelas-tabela-wrapper">
                            <table className="conta-receber-form-parcelas-tabela">
                              <thead>
                                <tr>
                                  <th>Nº</th>
                                  <th>Cód. Parcela</th>
                                  <th>Vencimento</th>
                                  <th className="conta-receber-col-valor">Valor</th>
                                  <th className="conta-receber-col-valor">Pago</th>
                                  <th>Data Pagamento</th>
                                  <th>Tipo Pagamento</th>
                                  <th>Status</th>
                                  {(podeBaixarParcela || podeEstornarParcela || parcelas.some(parcelaPaga)) && (
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
                                      <td>{p.IdContaReceberParcela}</td>
                                      <td className={classeVencimento(p.DataVencimento, paga)}>
                                        {formatarData(p.DataVencimento)}
                                      </td>
                                      <td className="conta-receber-col-valor">{formatarValor(p.ValorParcela)}</td>
                                      <td className="conta-receber-col-valor">{formatarValor(p.ValorPago)}</td>
                                      <td>{p.DataPagamento ? formatarData(p.DataPagamento) : "-"}</td>
                                      <td>{p.DescricaoTipoPagamento || "-"}</td>
                                      <td>
                                        <span className={`conta-receber-badge ${infoParcela.classe}`}>
                                          {infoParcela.label.toUpperCase()}
                                        </span>
                                        {parcelaEstornada(p) && (
                                          <span className="conta-receber-badge-estornada" title="Parcela estornada" />
                                        )}
                                      </td>
                                      {(podeBaixarParcela || podeEstornarParcela || parcelas.some(parcelaPaga)) && (
                                        <td className="conta-receber-col-acoes">
                                          {podeBaixarParcela && !paga && (
                                            <button
                                              type="button"
                                              className="conta-receber-icone-acao"
                                              title="Dar baixa nesta parcela"
                                              aria-label="Dar baixa nesta parcela"
                                              onClick={() =>
                                                setParcelaEmBaixa({ idContaReceber: c.IdContaReceber, parcela: p })
                                              }
                                            >
                                              <Banknote size={16} />
                                            </button>
                                          )}
                                          {podeEstornarParcela && paga && (
                                            <button
                                              type="button"
                                              className="conta-receber-icone-acao estorno"
                                              title="Estornar a baixa desta parcela"
                                              aria-label="Estornar a baixa desta parcela"
                                              onClick={() =>
                                                setParcelaEmEstorno({ idContaReceber: c.IdContaReceber, parcela: p })
                                              }
                                            >
                                              <Undo2 size={16} />
                                            </button>
                                          )}
                                          {paga && (
                                            <button
                                              type="button"
                                              className="conta-receber-icone-acao"
                                              title="Visualizar recibo"
                                              aria-label="Visualizar recibo"
                                              disabled={gerandoRecibo === p.IdContaReceberParcela}
                                              onClick={() => emitirRecibo(c, p)}
                                            >
                                              <Eye size={16} />
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

      <div className="conta-receber-rodape">
        <span>{contas.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="conta-receber-paginacao">
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

export default ContaReceberPage;
