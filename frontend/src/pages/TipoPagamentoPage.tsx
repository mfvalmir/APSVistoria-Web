import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarTiposPagamento, excluirTipoPagamento, TipoPagamento } from "../api/tipoPagamento";
import { ItemMenu } from "../api/menu";
import TipoPagamentoForm from "./TipoPagamentoForm";
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import "./TipoPagamentoPage.css";

type SubView = "lista" | "form";

const ITENS_POR_PAGINA = 15;

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "descricao", label: "Descrição" },
];
const COLUNAS_PADRAO = ["descricao"];

interface TipoPagamentoPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function TipoPagamentoPage({ permissoes, voltarInicio }: TipoPagamentoPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("tipoPagamento", COLUNAS_PADRAO)
  );

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("tipoPagamento", novo);
      return novo;
    });
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarTiposPagamento(busca || undefined);
      setTiposPagamento(dados);
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
  }, [busca, subView]);

  async function handleExcluir(tipoPagamento: TipoPagamento) {
    if (!window.confirm(`Excluir o tipo de pagamento "${tipoPagamento.DescricaoTipoPagamento}"?`)) return;
    try {
      await excluirTipoPagamento(tipoPagamento.idTipoPagamento);
      carregar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        window.alert(err.response.data?.erro || "Não foi possível excluir o tipo de pagamento");
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
    return <TipoPagamentoForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const totalPaginas = Math.max(1, Math.ceil(tiposPagamento.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const tiposPagamentoPagina = tiposPagamento.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  );

  return (
    <div className="tipo-pagamento-page">
      <div className="tipo-pagamento-toolbar">
        <button
          type="button"
          className="tipo-pagamento-btn-voltar"
          title="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="tipo-pagamento-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="tipo-pagamento-busca-limpar"
              title="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="tipo-pagamento-toolbar-espaco" />

        {podeAdicionar && (
          <button className="tipo-pagamento-btn-criar" onClick={abrirCriacao}>
            Criar Tipo de Pagamento
          </button>
        )}
      </div>

      <div className="tipo-pagamento-tabela-wrapper">
        <table className="tipo-pagamento-tabela">
          <thead>
            <tr>
              {colunasVisiveis.has("id") && <th>ID</th>}
              {colunasVisiveis.has("descricao") && <th>Descrição</th>}
              <th className="tipo-pagamento-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="tipo-pagamento-vazio">Carregando...</td>
              </tr>
            ) : tiposPagamentoPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="tipo-pagamento-vazio">Nenhum tipo de pagamento encontrado</td>
              </tr>
            ) : (
              tiposPagamentoPagina.map((t) => (
                <tr key={t.idTipoPagamento}>
                  {colunasVisiveis.has("id") && <td>{t.idTipoPagamento}</td>}
                  {colunasVisiveis.has("descricao") && <td>{t.DescricaoTipoPagamento}</td>}
                  <td className="tipo-pagamento-col-acoes">
                    {podeEditar && (
                      <button
                        className="tipo-pagamento-icone-acao editar"
                        title="Editar"
                        onClick={() => abrirEdicao(t.idTipoPagamento)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        className="tipo-pagamento-icone-acao perigo"
                        title="Excluir"
                        onClick={() => handleExcluir(t)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="tipo-pagamento-rodape">
        <span>{tiposPagamento.length} registros</span>
        <div className="tipo-pagamento-paginacao">
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

export default TipoPagamentoPage;
