import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarTiposPagamento, excluirTipoPagamento, TipoPagamento } from "../api/tipoPagamento";
import { ItemMenu } from "../api/menu";
import TipoPagamentoForm from "./TipoPagamentoForm";
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
import "./TipoPagamentoPage.css";

type SubView = "lista" | "form";

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
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("tipoPagamento", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("tipoPagamento"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("tipoPagamento", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("tipoPagamento", valor);
    setPagina(1);
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
    if (
      !(await confirmar({
        mensagem: `Excluir o tipo de pagamento "${tipoPagamento.DescricaoTipoPagamento}"?`,
        perigo: true,
      }))
    )
      return;
    try {
      await excluirTipoPagamento(tipoPagamento.idTipoPagamento);
      carregar();
      mostrarToast("Tipo de pagamento excluído com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir o tipo de pagamento", "erro");
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
    return <TipoPagamentoForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const tiposPagamentoOrdenados = ordenarLista(tiposPagamento, ordenacao, {
    id: (t) => t.idTipoPagamento,
    descricao: (t) => t.DescricaoTipoPagamento,
  });
  const colunasExportacao = colunasVisiveisParaExportacao<TipoPagamento>(COLUNAS, colunasVisiveis, {
    id: (t) => String(t.idTipoPagamento),
    descricao: (t) => t.DescricaoTipoPagamento,
  });

  const totalPaginas = Math.max(1, Math.ceil(tiposPagamentoOrdenados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const tiposPagamentoPagina = tiposPagamentoOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="tipo-pagamento-page">
      <div className="tipo-pagamento-toolbar">
        <button
          type="button"
          className="tipo-pagamento-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
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
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="tipo-pagamento-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="tipos-pagamento"
            titulo="Tipos de Pagamento"
            dados={tiposPagamentoOrdenados}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="tipo-pagamento-btn-criar" onClick={abrirCriacao}>
            Criar Tipo de Pagamento
          </button>
        )}
      </div>

      <div className={`tipo-pagamento-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="tipo-pagamento-tabela">
          <thead>
            <tr>
              {colunasVisiveis.has("id") && (
                <ThOrdenavel campo="id" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  ID
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("descricao") && (
                <ThOrdenavel campo="descricao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Descrição
                </ThOrdenavel>
              )}
              <th className="tipo-pagamento-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && tiposPagamentoPagina.length === 0 ? (
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
                        aria-label="Editar"
                        onClick={() => abrirEdicao(t.idTipoPagamento)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        className="tipo-pagamento-icone-acao perigo"
                        title="Excluir"
                        aria-label="Excluir"
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
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
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
