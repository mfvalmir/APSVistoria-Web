import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarCategorias, excluirCategoria, Categoria } from "../api/categoria";
import { ItemMenu } from "../api/menu";
import CategoriaForm from "./CategoriaForm";
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
import "./CategoriaPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "descricao", label: "Descrição" },
];
const COLUNAS_PADRAO = ["descricao"];

interface CategoriaPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function CategoriaPage({ permissoes, voltarInicio }: CategoriaPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("categoria", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("categoria"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("categoria", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("categoria", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarCategorias(busca || undefined);
      setCategorias(dados);
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

  async function handleExcluir(categoria: Categoria) {
    if (!(await confirmar({ mensagem: `Excluir a categoria "${categoria.DescricaoCategoria}"?`, perigo: true })))
      return;
    try {
      await excluirCategoria(categoria.IdCategoria);
      carregar();
      mostrarToast("Categoria excluída com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir a categoria", "erro");
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
    return <CategoriaForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const categoriasOrdenadas = ordenarLista(categorias, ordenacao, {
    id: (c) => c.IdCategoria,
    descricao: (c) => c.DescricaoCategoria,
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Categoria>(COLUNAS, colunasVisiveis, {
    id: (c) => String(c.IdCategoria),
    descricao: (c) => c.DescricaoCategoria,
  });

  const totalPaginas = Math.max(1, Math.ceil(categoriasOrdenadas.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const categoriasPagina = categoriasOrdenadas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="categoria-page">
      <div className="categoria-toolbar">
        <button
          type="button"
          className="categoria-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="categoria-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="categoria-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="categoria-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="categorias"
            titulo="Categorias"
            dados={categoriasOrdenadas}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="categoria-btn-criar" onClick={abrirCriacao}>
            Criar Categoria
          </button>
        )}
      </div>

      <div className={`categoria-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="categoria-tabela">
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
              <th className="categoria-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && categoriasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="categoria-vazio">Carregando...</td>
              </tr>
            ) : categoriasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="categoria-vazio">Nenhuma categoria encontrada</td>
              </tr>
            ) : (
              categoriasPagina.map((c) => (
                <tr key={c.IdCategoria}>
                  {colunasVisiveis.has("id") && <td>{c.IdCategoria}</td>}
                  {colunasVisiveis.has("descricao") && <td>{c.DescricaoCategoria}</td>}
                  <td className="categoria-col-acoes">
                    {podeEditar && (
                      <button
                        className="categoria-icone-acao editar"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => abrirEdicao(c.IdCategoria)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        className="categoria-icone-acao perigo"
                        title="Excluir"
                        aria-label="Excluir"
                        onClick={() => handleExcluir(c)}
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

      <div className="categoria-rodape">
        <span>{categorias.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="categoria-paginacao">
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

export default CategoriaPage;
