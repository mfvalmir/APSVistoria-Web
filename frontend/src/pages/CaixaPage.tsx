import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarCaixas, excluirCaixa, Caixa } from "../api/caixa";
import { ItemMenu } from "../api/menu";
import CaixaForm from "./CaixaForm";
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import "./CaixaPage.css";

type SubView = "lista" | "form";
type FiltroStatus = "aberto" | "fechado" | "todos";

const ITENS_POR_PAGINA = 15;

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

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<FiltroStatus>("aberto");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("caixa", COLUNAS_PADRAO)
  );

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("caixa", novo);
      return novo;
    });
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarCaixas(busca || undefined, status, dataInicial || undefined, dataFinal || undefined);
      setCaixas(dados);
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
      !window.confirm(
        `Excluir definitivamente o caixa nº ${pad6(caixa.idCaixa)}? Isso remove também todos os movimentos de caixa vinculados.`
      )
    )
      return;
    try {
      await excluirCaixa(caixa.idCaixa);
      carregar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        window.alert(err.response.data?.erro || "Não foi possível excluir o caixa");
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
      <CaixaForm
        id={idSelecionado}
        onVoltar={voltarParaLista}
        navegarPara={navegarPara}
        permissoes={permissoes}
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(caixas.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const caixasPagina = caixas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  return (
    <div className="caixa-page">
      <div className="caixa-toolbar">
        <button type="button" className="caixa-btn-voltar" title="Voltar para Início" onClick={voltarInicio}>
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="caixa-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button type="button" className="caixa-busca-limpar" title="Limpar busca" onClick={() => setBusca("")}>
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

        {podeAdicionar && (
          <button className="caixa-btn-criar" onClick={abrirCriacao}>
            Abrir Caixa
          </button>
        )}
      </div>

      <div className="caixa-tabela-wrapper">
        <table className="caixa-tabela">
          <thead>
            <tr>
              {colunasVisiveis.has("id") && <th>Nº</th>}
              {colunasVisiveis.has("dataAbertura") && <th>Dt. Abertura</th>}
              {colunasVisiveis.has("saldoInicial") && <th className="caixa-col-valor">Saldo Inicial</th>}
              {colunasVisiveis.has("usuarioAbertura") && <th>Funcionário de Abertura</th>}
              {colunasVisiveis.has("dataFechamento") && <th>Dt. Fechamento</th>}
              {colunasVisiveis.has("saldoFinal") && <th className="caixa-col-valor">Saldo Final</th>}
              {colunasVisiveis.has("usuarioFechamento") && <th>Funcionário de Fechamento</th>}
              {colunasVisiveis.has("status") && <th className="caixa-col-status">Status</th>}
              <th className="caixa-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="caixa-vazio">
                  Carregando...
                </td>
              </tr>
            ) : caixasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="caixa-vazio">
                  Nenhum caixa encontrado
                </td>
              </tr>
            ) : (
              caixasPagina.map((c) => {
                const aberto = !c.DataFechamento;
                return (
                  <tr key={c.idCaixa}>
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
                          onClick={() => abrirEdicao(c.idCaixa)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && aberto && (
                        <button
                          className="caixa-icone-acao perigo"
                          title="Excluir"
                          onClick={() => handleExcluir(c)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="caixa-rodape">
        <span>{caixas.length} registros</span>
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
