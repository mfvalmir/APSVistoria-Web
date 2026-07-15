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
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import "./ContaPagarForm.css";
import "./ContaPagarPage.css";

type SubView = "lista" | "form";

const ITENS_POR_PAGINA = 15;

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

  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [parcelasPorConta, setParcelasPorConta] = useState<Record<number, ParcelaContaPagar[]>>({});
  const [carregandoParcelas, setCarregandoParcelas] = useState<Set<number>>(new Set());

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

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("conta-pagar", novo);
      return novo;
    });
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
      !window.confirm(
        `Excluir definitivamente a conta "${conta.Descricao}"? Isso remove também todas as parcelas, mesmo as já pagas.`
      )
    )
      return;
    try {
      await excluirContaPagar(conta.idContaPagar);
      carregar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        window.alert(err.response.data?.erro || "Não foi possível excluir a conta a pagar");
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
      <ContaPagarForm
        id={idSelecionado}
        onVoltar={voltarParaLista}
        navegarPara={navegarPara}
        permissoes={permissoes}
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(contas.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const contasPagina = contas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  return (
    <div className="conta-pagar-page">
      <div className="conta-pagar-toolbar">
        <button
          type="button"
          className="conta-pagar-btn-voltar"
          title="Voltar para Início"
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

        {podeAdicionar && (
          <button className="conta-pagar-btn-criar" onClick={abrirCriacao}>
            Criar Conta a Pagar
          </button>
        )}
      </div>

      <div className="conta-pagar-tabela-wrapper">
        <table className="conta-pagar-tabela">
          <thead>
            <tr>
              <th className="conta-pagar-col-expandir"></th>
              {colunasVisiveis.has("id") && <th>ID</th>}
              {colunasVisiveis.has("numeroDocumento") && <th>Documento</th>}
              {colunasVisiveis.has("descricao") && <th>Descrição</th>}
              {colunasVisiveis.has("fornecedor") && <th>Fornecedor</th>}
              {colunasVisiveis.has("categoria") && <th>Categoria</th>}
              {colunasVisiveis.has("valorTotal") && <th className="conta-pagar-col-valor">Valor Total</th>}
              {colunasVisiveis.has("saldoDevedor") && <th className="conta-pagar-col-valor">Saldo Devedor</th>}
              {colunasVisiveis.has("dataEmissao") && <th>Emissão</th>}
              {colunasVisiveis.has("status") && <th className="conta-pagar-col-status">Status</th>}
              <th className="conta-pagar-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
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
                  <tr className={expandido ? "conta-pagar-linha-pai-expandida" : undefined}>
                    <td className="conta-pagar-col-expandir">
                      <button
                        type="button"
                        className={`conta-pagar-btn-expandir ${expandido ? "aberto" : ""}`}
                        title={expandido ? "Ocultar parcelas" : "Ver parcelas"}
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
                      </td>
                    )}
                    <td className="conta-pagar-col-acoes">
                      {podeEditar && (
                        <button
                          className="conta-pagar-icone-acao editar"
                          title="Editar"
                          onClick={() => abrirEdicao(c.idContaPagar)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="conta-pagar-icone-acao perigo"
                          title="Excluir"
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
                                  <th>Vencimento</th>
                                  <th className="conta-pagar-col-valor">Valor</th>
                                  <th className="conta-pagar-col-valor">Pago</th>
                                  <th>Data Pagamento</th>
                                  <th>Tipo Pagamento</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parcelas.map((p) => {
                                  const infoParcela = statusInfo(p.IdStatusParcela);
                                  return (
                                    <tr key={p.IdContaPagarParcela}>
                                      <td>{pad3(p.NumeroParcela)}</td>
                                      <td>{formatarData(p.DataVencimento)}</td>
                                      <td className="conta-pagar-col-valor">{formatarValor(p.ValorParcela)}</td>
                                      <td className="conta-pagar-col-valor">{formatarValor(p.ValorPago)}</td>
                                      <td>{p.DataPagamento ? formatarData(p.DataPagamento) : "-"}</td>
                                      <td>{p.DescricaoTipoPagamento || "-"}</td>
                                      <td>
                                        <span className={`conta-pagar-badge ${infoParcela.classe}`}>
                                          {infoParcela.label.toUpperCase()}
                                        </span>
                                      </td>
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
    </div>
  );
}

export default ContaPagarPage;
