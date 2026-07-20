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
  FileText,
} from "lucide-react";
import { listarCaixas, excluirCaixa, obterCaixa, Caixa, MovimentoCaixa, ORIGEM_MOVIMENTO } from "../api/caixa";
import { ItemMenu } from "../api/menu";
import CaixaForm from "./CaixaForm";
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import ThOrdenavel from "../components/ThOrdenavel";
import BotaoExportar from "../components/BotaoExportar";
import { gerarExtratoCaixa } from "../utils/extratoCaixa";
import SeletorItensPorPagina from "../components/SeletorItensPorPagina";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import { obterItensPorPagina, salvarItensPorPagina } from "../utils/itensPorPagina";
import { useOrdenacao, ordenarLista } from "../utils/ordenacao";
import { colunasVisiveisParaExportacao } from "../utils/exportarCsv";
import { useToast } from "../contexts/ToastContext";
import { useConfirmacao } from "../contexts/ConfirmContext";
import "./CaixaForm.css";
import "./CaixaPage.css";

type SubView = "lista" | "form";
type FiltroStatus = "aberto" | "fechado" | "todos";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "Nº" },
  { chave: "dataAbertura", label: "Dt. Abertura" },
  { chave: "saldoInicial", label: "Saldo Inicial" },
  { chave: "usuarioAbertura", label: "Funcionário de Abertura" },
  { chave: "dataFechamento", label: "Dt. Fechamento" },
  { chave: "saldoFinal", label: "Saldo Final" },
  { chave: "usuarioFechamento", label: "Funcionário de Fechamento" },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = [
  "id",
  "dataAbertura",
  "saldoInicial",
  "usuarioAbertura",
  "dataFechamento",
  "saldoFinal",
  "usuarioFechamento",
  "status",
];

function formatarValor(valor: number | null): string {
  if (valor === null) return "-";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(valor: string | null): string {
  if (!valor) return "-";
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function pad6(valor: number): string {
  return String(valor).padStart(6, "0");
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

interface CaixaPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
  voltarInicio: () => void;
}

function CaixaPage({ permissoes, navegarPara, voltarInicio }: CaixaPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [existeCaixaAberto, setExisteCaixaAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<FiltroStatus>("aberto");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("caixa", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("caixa"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [movimentosPorCaixa, setMovimentosPorCaixa] = useState<Record<number, MovimentoCaixa[]>>({});
  const [carregandoMovimentos, setCarregandoMovimentos] = useState<Set<number>>(new Set());
  const [gerandoExtrato, setGerandoExtrato] = useState(false);

  // Com exatamente 1 caixa expandido (mostrando os movimentos), esse é o "selecionado" pra
  // exportar - nesse caso o botão gera o extrato dele (cabeçalho + itens) em vez da listagem
  // genérica. Com 0 ou vários expandidos, mantém a exportação normal da listagem.
  const idCaixaSelecionadoParaExtrato = expandidos.size === 1 ? Array.from(expandidos)[0] : null;

  async function gerarExtratoCaixaSelecionado() {
    if (idCaixaSelecionadoParaExtrato === null) return;
    setGerandoExtrato(true);
    try {
      const dados = await obterCaixa(idCaixaSelecionadoParaExtrato);
      gerarExtratoCaixa(dados, dados.movimentos);
    } catch {
      mostrarToast("Não foi possível gerar o extrato do caixa", "erro");
    } finally {
      setGerandoExtrato(false);
    }
  }

  async function alternarExpandir(idCaixa: number) {
    const estavaExpandido = expandidos.has(idCaixa);
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (estavaExpandido) novo.delete(idCaixa);
      else novo.add(idCaixa);
      return novo;
    });

    if (estavaExpandido || movimentosPorCaixa[idCaixa]) return;

    setCarregandoMovimentos((atual) => new Set(atual).add(idCaixa));
    try {
      const dados = await obterCaixa(idCaixa);
      setMovimentosPorCaixa((atual) => ({ ...atual, [idCaixa]: dados.movimentos }));
    } finally {
      setCarregandoMovimentos((atual) => {
        const novo = new Set(atual);
        novo.delete(idCaixa);
        return novo;
      });
    }
  }

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("caixa", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("caixa", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      // Independente do filtro de status escolhido na tela, sempre confere se já existe algum
      // caixa aberto - usado pra desabilitar "Abrir Caixa" (só pode haver 1 caixa aberto por vez).
      const [dados, abertos] = await Promise.all([
        listarCaixas(busca || undefined, status, dataInicial || undefined, dataFinal || undefined),
        listarCaixas(undefined, "aberto"),
      ]);
      setCaixas(dados);
      setExisteCaixaAberto(abertos.length > 0);
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
  }, [busca, status, dataInicial, dataFinal, subView]);

  async function handleExcluir(caixa: Caixa) {
    if (
      !(await confirmar({
        mensagem: `Excluir definitivamente o caixa nº ${pad6(caixa.idCaixa)}? Isso remove também todos os movimentos de caixa vinculados.`,
        perigo: true,
      }))
    )
      return;
    try {
      await excluirCaixa(caixa.idCaixa);
      carregar();
      mostrarToast("Caixa excluído com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir o caixa", "erro");
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
      <CaixaForm
        id={idSelecionado}
        onVoltar={voltarParaLista}
        navegarPara={navegarPara}
        permissoes={permissoes}
      />
    );
  }

  const caixasOrdenados = ordenarLista(caixas, ordenacao, {
    id: (c) => c.idCaixa,
    dataAbertura: (c) => c.DataAbertura,
    saldoInicial: (c) => c.SaldoInicial,
    usuarioAbertura: (c) => c.NomeUsuarioAbertura || "",
    dataFechamento: (c) => c.DataFechamento || "",
    saldoFinal: (c) => c.SaldoFinal,
    usuarioFechamento: (c) => c.NomeUsuarioFechamento || "",
    status: (c) => (c.DataFechamento ? "fechado" : "aberto"),
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Caixa>(COLUNAS, colunasVisiveis, {
    id: (c) => pad6(c.idCaixa),
    dataAbertura: (c) => formatarData(c.DataAbertura),
    saldoInicial: (c) => formatarValor(c.SaldoInicial),
    usuarioAbertura: (c) => c.NomeUsuarioAbertura || "-",
    dataFechamento: (c) => formatarData(c.DataFechamento),
    saldoFinal: (c) => formatarValor(c.SaldoFinal),
    usuarioFechamento: (c) => c.NomeUsuarioFechamento || "-",
    status: (c) => (c.DataFechamento ? "FECHADO" : "ABERTO"),
  });

  const totalPaginas = Math.max(1, Math.ceil(caixasOrdenados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const caixasPagina = caixasOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="caixa-page">
      <div className="caixa-toolbar">
        <button
          type="button"
          className="caixa-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="caixa-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="caixa-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="caixa-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as FiltroStatus)}
        >
          <option value="aberto">Aberto</option>
          <option value="fechado">Fechado</option>
          <option value="todos">Todos</option>
        </select>

        <div className="caixa-filtro-periodo">
          <label>Abertura de</label>
          <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
          <label>até</label>
          <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
        </div>

        <div className="caixa-toolbar-espaco" />

        {podeExportar && idCaixaSelecionadoParaExtrato !== null ? (
          <button
            type="button"
            className="caixa-btn-extrato"
            title="Gerar extrato do caixa selecionado, com os movimentos"
            onClick={gerarExtratoCaixaSelecionado}
            disabled={gerandoExtrato}
          >
            <FileText size={16} />
            {gerandoExtrato ? "Gerando..." : "Extrato do caixa"}
          </button>
        ) : (
          podeExportar && (
            <BotaoExportar
              nomeArquivo="caixa"
              titulo="Caixa"
              dados={caixasOrdenados}
              colunas={colunasExportacao}
            />
          )
        )}

        {podeAdicionar && (
          <button
            className="caixa-btn-criar"
            onClick={abrirCriacao}
            disabled={existeCaixaAberto}
            title={existeCaixaAberto ? "Já existe um caixa aberto - feche-o antes de abrir outro" : undefined}
          >
            Abrir Caixa
          </button>
        )}
      </div>

      <div className={`caixa-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="caixa-tabela">
          <thead>
            <tr>
              <th className="caixa-col-expandir"></th>
              {colunasVisiveis.has("id") && (
                <ThOrdenavel campo="id" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Nº
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("dataAbertura") && (
                <ThOrdenavel campo="dataAbertura" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Dt. Abertura
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("saldoInicial") && (
                <ThOrdenavel
                  campo="saldoInicial"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="caixa-col-valor"
                >
                  Saldo Inicial
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("usuarioAbertura") && (
                <ThOrdenavel campo="usuarioAbertura" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Funcionário de Abertura
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("dataFechamento") && (
                <ThOrdenavel campo="dataFechamento" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Dt. Fechamento
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("saldoFinal") && (
                <ThOrdenavel
                  campo="saldoFinal"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="caixa-col-valor"
                >
                  Saldo Final
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("usuarioFechamento") && (
                <ThOrdenavel campo="usuarioFechamento" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Funcionário de Fechamento
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("status") && (
                <ThOrdenavel
                  campo="status"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="caixa-col-status"
                >
                  Status
                </ThOrdenavel>
              )}
              <th className="caixa-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && caixasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="caixa-vazio">
                  Carregando...
                </td>
              </tr>
            ) : caixasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="caixa-vazio">
                  Nenhum caixa encontrado
                </td>
              </tr>
            ) : (
              caixasPagina.map((c) => {
                const aberto = !c.DataFechamento;
                const expandido = expandidos.has(c.idCaixa);
                const movimentos = movimentosPorCaixa[c.idCaixa];
                return (
                  <Fragment key={c.idCaixa}>
                    <tr
                      className={
                        expandido
                          ? `caixa-linha-pai-expandida caixa-linha-pai-expandida-${aberto ? "aberto" : "fechado"}`
                          : undefined
                      }
                    >
                      <td className="caixa-col-expandir">
                        <button
                          type="button"
                          className={`caixa-btn-expandir ${expandido ? "aberto" : ""}`}
                          title={expandido ? "Ocultar movimentos" : "Ver movimentos"}
                          aria-label={expandido ? "Ocultar movimentos" : "Ver movimentos"}
                          onClick={() => alternarExpandir(c.idCaixa)}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </td>
                      {colunasVisiveis.has("id") && <td>{pad6(c.idCaixa)}</td>}
                    {colunasVisiveis.has("dataAbertura") && <td>{formatarData(c.DataAbertura)}</td>}
                    {colunasVisiveis.has("saldoInicial") && (
                      <td className="caixa-col-valor">{formatarValor(c.SaldoInicial)}</td>
                    )}
                    {colunasVisiveis.has("usuarioAbertura") && <td>{c.NomeUsuarioAbertura || "-"}</td>}
                    {colunasVisiveis.has("dataFechamento") && <td>{formatarData(c.DataFechamento)}</td>}
                    {colunasVisiveis.has("saldoFinal") && (
                      <td className="caixa-col-valor">{formatarValor(c.SaldoFinal)}</td>
                    )}
                    {colunasVisiveis.has("usuarioFechamento") && <td>{c.NomeUsuarioFechamento || "-"}</td>}
                    {colunasVisiveis.has("status") && (
                      <td className="caixa-col-status">
                        <span className={`caixa-badge ${aberto ? "aberto" : "fechado"}`}>
                          {aberto ? "ABERTO" : "FECHADO"}
                        </span>
                      </td>
                    )}
                    <td className="caixa-col-acoes">
                      {podeEditar && (
                        <button
                          className="caixa-icone-acao editar"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => abrirEdicao(c.idCaixa)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && aberto && (
                        <button
                          className="caixa-icone-acao perigo"
                          title="Excluir"
                          aria-label="Excluir"
                          onClick={() => handleExcluir(c)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="caixa-linha-expandida">
                        <td colSpan={colunasVisiveis.size + 2} className="caixa-movimentos-celula">
                          {carregandoMovimentos.has(c.idCaixa) ? (
                            <div className="caixa-movimentos-estado">Carregando movimentos...</div>
                          ) : !movimentos || movimentos.length === 0 ? (
                            <div className="caixa-movimentos-estado">Nenhum movimento neste caixa.</div>
                          ) : (
                            <div className="caixa-form-movimentos-tabela-wrapper">
                              <table className="caixa-form-movimentos-tabela">
                                <thead>
                                  <tr>
                                    <th>Mov. Nº</th>
                                    <th>Tipo</th>
                                    <th>Data/Hora</th>
                                    <th>Tipo Pgto.</th>
                                    <th className="caixa-col-valor">Valor</th>
                                    <th>Código</th>
                                    <th>Origem</th>
                                    <th>Descrição</th>
                                    <th>Usuário</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {movimentos.map((m) => (
                                    <tr key={m.idMovimento}>
                                      <td>{pad6(m.idMovimento)}</td>
                                      <td>
                                        <span
                                          className={`caixa-badge-tipo ${m.TipoMovimento === "E" ? "entrada" : "saida"}`}
                                        >
                                          {m.TipoMovimento === "E" ? "Entrada" : "Saída"}
                                        </span>
                                      </td>
                                      <td>{formatarDataHora(m.DataHora)}</td>
                                      <td>{m.DescricaoTipoPagamento || "-"}</td>
                                      <td className="caixa-col-valor">{formatarValor(m.Valor)}</td>
                                      <td>{m.idOrigem !== null ? pad6(m.idOrigem) : "-"}</td>
                                      <td>{ORIGEM_MOVIMENTO[m.TipoOrigem] || "-"}</td>
                                      <td className="caixa-form-movimentos-descricao">{m.Descricao || "-"}</td>
                                      <td>{m.idusuario !== null ? pad6(m.idusuario) : "-"}</td>
                                    </tr>
                                  ))}
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

      <div className="caixa-rodape">
        <span>{caixas.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="caixa-paginacao">
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

export default CaixaPage;
