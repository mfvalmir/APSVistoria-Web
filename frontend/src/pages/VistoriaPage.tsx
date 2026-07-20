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
import { listarVistorias, excluirVistoria, obterVistoria, Vistoria, STATUS_VISTORIA } from "../api/vistoria";
import { ParcelaContaReceber } from "../api/contaReceber";
import { ItemMenu } from "../api/menu";
import VistoriaForm from "./VistoriaForm";
import ContaReceberBaixaModal from "./ContaReceberBaixaModal";
import ContaReceberEstornoModal from "./ContaReceberEstornoModal";
import { visualizarRecibo } from "../utils/recibo";
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
import "./VistoriaForm.css";
import "./VistoriaPage.css";

type SubView = "lista" | "form";

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
  const podeExportar = permissoes?.imprimir ?? false;

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
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("vistoria"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

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
  const [gerandoRecibo, setGerandoRecibo] = useState<number | null>(null);
  const [gerandoReciboAVista, setGerandoReciboAVista] = useState<number | null>(null);

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

  async function emitirRecibo(v: Vistoria, p: ParcelaContaReceber) {
    setGerandoRecibo(p.IdContaReceberParcela);
    try {
      const parcelasDaVistoria = parcelasPorVistoria[v.idVistoria] || [];
      await visualizarRecibo({
        numeroRecibo: `${v.idVistoria}-${pad3(p.NumeroParcela)}`,
        nomePagador: v.NomeCliente?.trim() || "Cliente não identificado",
        documentoPagador: v.CpfCnpj || null,
        valor: p.ValorPago || p.ValorParcela,
        dataPagamento: p.DataPagamento || new Date().toISOString(),
        formaPagamento: p.DescricaoTipoPagamento || "-",
        referente: `à parcela nº ${pad3(p.NumeroParcela)}/${pad3(parcelasDaVistoria.length)} da Vistoria nº ${
          v.idVistoria
        } - Veículo placa ${v.PlacaVeiculo} - Serviço: ${v.DescricaoServico || "-"}`,
        observacao: p.Observacao,
      });
    } catch {
      mostrarToast("Não foi possível gerar o recibo", "erro");
    } finally {
      setGerandoRecibo(null);
    }
  }

  // A 1ª parcela de uma Vistoria à vista nunca vira uma linha em ContaReceberParcela - a
  // procedure Manter_Vistoria trata esse pagamento só via CaixaMovimento, ligado direto na
  // Vistoria. Por isso o recibo é montado a partir do próprio cabeçalho (já disponível em `v`,
  // sem precisar buscar nada), não de uma parcela da tabela expandida.
  async function verReciboAVista(v: Vistoria) {
    setGerandoReciboAVista(v.idVistoria);
    try {
      // Com mais de 1 parcela, o que nasce pago é só a entrada - o restante segue em aberto nas
      // parcelas seguintes. Com 1 parcela só, o pagamento é o valor à vista, total mesmo.
      const tipoPagamento = v.TotalParcelas > 1 ? "da entrada" : "à vista";
      await visualizarRecibo({
        numeroRecibo: `${v.idVistoria}-001`,
        nomePagador: v.NomeCliente?.trim() || "Cliente não identificado",
        documentoPagador: v.CpfCnpj || null,
        valor: v.ValorTotalServico - (v.SaldoDevedor ?? 0),
        dataPagamento: v.DataEmissao,
        formaPagamento: v.DescricaoTipoPagamento || "-",
        referente: `ao pagamento ${tipoPagamento} da Vistoria nº ${v.idVistoria} - Veículo placa ${
          v.PlacaVeiculo
        } - Serviço: ${v.DescricaoServico || "-"}`,
        observacao: v.Observacao,
      });
    } catch {
      mostrarToast("Não foi possível gerar o recibo", "erro");
    } finally {
      setGerandoReciboAVista(null);
    }
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

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("vistoria", valor);
    setPagina(1);
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
      !(await confirmar({
        mensagem: `Excluir definitivamente a vistoria da placa "${vistoria.PlacaVeiculo}"? Isso não remove eventuais contas a receber/parcelas já geradas.`,
        perigo: true,
      }))
    )
      return;
    try {
      await excluirVistoria(vistoria.idVistoria);
      carregar();
      mostrarToast("Vistoria excluída com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir a vistoria", "erro");
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
      <VistoriaForm
        id={idSelecionado}
        onVoltar={voltarParaLista}
        navegarPara={navegarPara}
        permissoes={permissoes}
      />
    );
  }

  const vistoriasOrdenadas = ordenarLista(vistorias, ordenacao, {
    id: (v) => v.idVistoria,
    emissao: (v) => v.DataEmissao,
    placa: (v) => v.PlacaVeiculo,
    cliente: (v) => v.NomeCliente || "",
    cpfCnpj: (v) => v.CpfCnpj || "",
    responsavel: (v) => v.NomeResponsavel || "",
    vistoriador: (v) => v.NomeVistoriador || "",
    servico: (v) => v.DescricaoServico || "",
    total: (v) => v.ValorTotalServico,
    tipoPagamento: (v) => v.DescricaoTipoPagamento || "",
    status: (v) => v.idStatusVistoria,
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Vistoria>(COLUNAS, colunasVisiveis, {
    id: (v) => String(v.idVistoria),
    emissao: (v) => formatarData(v.DataEmissao),
    placa: (v) => v.PlacaVeiculo,
    cliente: (v) => v.NomeCliente || "-",
    cpfCnpj: (v) => v.CpfCnpj || "-",
    responsavel: (v) => v.NomeResponsavel || "-",
    vistoriador: (v) => v.NomeVistoriador || "-",
    servico: (v) => v.DescricaoServico || "-",
    total: (v) => formatarValor(v.ValorTotalServico),
    tipoPagamento: (v) => v.DescricaoTipoPagamento || "-",
    status: (v) => statusInfo(v.idStatusVistoria).label.toUpperCase(),
  });

  const totalPaginas = Math.max(1, Math.ceil(vistoriasOrdenadas.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const vistoriasPagina = vistoriasOrdenadas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="vistoria-page">
      <div className="vistoria-toolbar">
        <button
          type="button"
          className="vistoria-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
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
            <button
              type="button"
              className="vistoria-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
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

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="vistorias"
            titulo="Vistorias"
            dados={vistoriasOrdenadas}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="vistoria-btn-criar" onClick={abrirCriacao}>
            Lançar Vistoria
          </button>
        )}
      </div>

      <div className={`vistoria-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="vistoria-tabela">
          <thead>
            <tr>
              <th className="vistoria-col-expandir"></th>
              {colunasVisiveis.has("id") && (
                <ThOrdenavel campo="id" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Código
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("emissao") && (
                <ThOrdenavel campo="emissao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Emissão
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("placa") && (
                <ThOrdenavel campo="placa" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Placa
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("cliente") && (
                <ThOrdenavel campo="cliente" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Cliente
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("cpfCnpj") && (
                <ThOrdenavel campo="cpfCnpj" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Cpf/Cnpj
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("responsavel") && (
                <ThOrdenavel campo="responsavel" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Responsável
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("vistoriador") && (
                <ThOrdenavel campo="vistoriador" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Vistoriador
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("servico") && (
                <ThOrdenavel campo="servico" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Serviço
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("total") && (
                <ThOrdenavel
                  campo="total"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="vistoria-col-valor"
                >
                  Total
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("tipoPagamento") && (
                <ThOrdenavel campo="tipoPagamento" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Tipo Pgto.
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("status") && (
                <ThOrdenavel
                  campo="status"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="vistoria-col-status"
                >
                  Status
                </ThOrdenavel>
              )}
              <th className="vistoria-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && vistoriasPagina.length === 0 ? (
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
                          aria-label={expandido ? "Ocultar parcelas" : "Ver parcelas"}
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
                            aria-label="Editar"
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
                            aria-label={
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
                          {(v.idStatusVistoria === 1 || v.idStatusVistoria === 2) && (
                            <div className="vistoria-form-avista">
                              <p>
                                A 1ª parcela nasceu paga (pagamento à vista lançado direto no caixa) - por isso
                                não aparece na tabela de parcelas abaixo.
                              </p>
                              <button
                                type="button"
                                className="vistoria-form-btn-recibo-avista"
                                disabled={gerandoReciboAVista === v.idVistoria}
                                onClick={() => verReciboAVista(v)}
                              >
                                <Eye size={16} />
                                Visualizar recibo
                              </button>
                            </div>
                          )}
                          {carregandoParcelas.has(v.idVistoria) ? (
                            <div className="vistoria-parcelas-estado">Carregando parcelas...</div>
                          ) : !parcelas || parcelas.length === 0 ? (
                            (v.idStatusVistoria !== 1 && v.idStatusVistoria !== 2) && (
                              <div className="vistoria-parcelas-estado">Nenhuma parcela nesta vistoria.</div>
                            )
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
                                            {podeBaixarParcela && !paga && v.idContaReceber && (
                                              <button
                                                type="button"
                                                className="conta-receber-icone-acao"
                                                title="Dar baixa nesta parcela"
                                                aria-label="Dar baixa nesta parcela"
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
                                                aria-label="Estornar a baixa desta parcela"
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
                                            {paga && (
                                              <button
                                                type="button"
                                                className="conta-receber-icone-acao"
                                                title="Visualizar recibo"
                                                aria-label="Visualizar recibo"
                                                disabled={gerandoRecibo === p.IdContaReceberParcela}
                                                onClick={() => emitirRecibo(v, p)}
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

      <div className="vistoria-rodape">
        <span>{vistorias.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
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
