import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarFuncoes, excluirFuncao, Funcao } from "../api/funcao";
import { ItemMenu } from "../api/menu";
import FuncaoForm from "./FuncaoForm";
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
import "./FuncaoPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "descricao", label: "Descrição" },
];
const COLUNAS_PADRAO = ["descricao"];

interface FuncaoPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function FuncaoPage({ permissoes, voltarInicio }: FuncaoPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("funcao", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("funcao"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("funcao", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("funcao", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarFuncoes(busca || undefined);
      setFuncoes(dados);
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

  async function handleExcluir(funcao: Funcao) {
    if (!(await confirmar({ mensagem: `Excluir a função "${funcao.descricao}"?`, perigo: true }))) return;
    try {
      await excluirFuncao(funcao.idFuncao);
      carregar();
      mostrarToast("Função excluída com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir a função", "erro");
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
    return <FuncaoForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const funcoesOrdenadas = ordenarLista(funcoes, ordenacao, {
    id: (f) => f.idFuncao,
    descricao: (f) => f.descricao,
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Funcao>(COLUNAS, colunasVisiveis, {
    id: (f) => String(f.idFuncao),
    descricao: (f) => f.descricao,
  });

  const totalPaginas = Math.max(1, Math.ceil(funcoesOrdenadas.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const funcoesPagina = funcoesOrdenadas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="funcao-page">
      <div className="funcao-toolbar">
        <button
          type="button"
          className="funcao-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="funcao-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="funcao-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="funcao-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="funcoes"
            titulo="Funções"
            dados={funcoesOrdenadas}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="funcao-btn-criar" onClick={abrirCriacao}>
            Criar Função
          </button>
        )}
      </div>

      <div className={`funcao-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="funcao-tabela">
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
              <th className="funcao-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && funcoesPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="funcao-vazio">Carregando...</td>
              </tr>
            ) : funcoesPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="funcao-vazio">Nenhuma função encontrada</td>
              </tr>
            ) : (
              funcoesPagina.map((f) => (
                <tr key={f.idFuncao}>
                  {colunasVisiveis.has("id") && <td>{f.idFuncao}</td>}
                  {colunasVisiveis.has("descricao") && <td>{f.descricao}</td>}
                  <td className="funcao-col-acoes">
                    {podeEditar && (
                      <button
                        className="funcao-icone-acao editar"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => abrirEdicao(f.idFuncao)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        className="funcao-icone-acao perigo"
                        title="Excluir"
                        aria-label="Excluir"
                        onClick={() => handleExcluir(f)}
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

      <div className="funcao-rodape">
        <span>{funcoes.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="funcao-paginacao">
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

export default FuncaoPage;
