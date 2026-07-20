import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarCidades, excluirCidade, Cidade } from "../api/cidades";
import { ItemMenu } from "../api/menu";
import CidadeForm from "./CidadeForm";
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
import "./CidadesPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "descricao", label: "Descrição" },
  { chave: "uf", label: "UF" },
];
const COLUNAS_PADRAO = ["descricao", "uf"];

interface CidadesPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function CidadesPage({ permissoes, voltarInicio }: CidadesPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("cidades", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("cidades"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("cidades", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("cidades", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarCidades(busca || undefined);
      setCidades(dados);
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

  async function handleExcluir(cidade: Cidade) {
    if (!(await confirmar({ mensagem: `Excluir a cidade "${cidade.DescricaoCidade}"?`, perigo: true }))) return;
    try {
      await excluirCidade(cidade.idCidade);
      carregar();
      mostrarToast("Cidade excluída com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir a cidade", "erro");
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
    return <CidadeForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const cidadesOrdenadas = ordenarLista(cidades, ordenacao, {
    id: (c) => c.idCidade,
    descricao: (c) => c.DescricaoCidade,
    uf: (c) => c.UF,
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Cidade>(COLUNAS, colunasVisiveis, {
    id: (c) => String(c.idCidade),
    descricao: (c) => c.DescricaoCidade,
    uf: (c) => c.UF,
  });

  const totalPaginas = Math.max(1, Math.ceil(cidadesOrdenadas.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const cidadesPagina = cidadesOrdenadas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="cidades-page">
      <div className="cidades-toolbar">
        <button
          type="button"
          className="cidades-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="cidades-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="cidades-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="cidades-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="cidades"
            titulo="Cidades"
            dados={cidadesOrdenadas}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="cidades-btn-criar" onClick={abrirCriacao}>
            Criar Cidade
          </button>
        )}
      </div>

      <div className={`cidades-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="cidades-tabela">
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
              {colunasVisiveis.has("uf") && (
                <ThOrdenavel
                  campo="uf"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="cidades-col-uf"
                >
                  UF
                </ThOrdenavel>
              )}
              <th className="cidades-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && cidadesPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="cidades-vazio">Carregando...</td>
              </tr>
            ) : cidadesPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="cidades-vazio">Nenhuma cidade encontrada</td>
              </tr>
            ) : (
              cidadesPagina.map((c) => (
                <tr key={c.idCidade}>
                  {colunasVisiveis.has("id") && <td>{c.idCidade}</td>}
                  {colunasVisiveis.has("descricao") && <td>{c.DescricaoCidade}</td>}
                  {colunasVisiveis.has("uf") && <td className="cidades-col-uf">{c.UF}</td>}
                  <td className="cidades-col-acoes">
                    {podeEditar && (
                      <button
                        className="cidades-icone-acao editar"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => abrirEdicao(c.idCidade)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        className="cidades-icone-acao perigo"
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

      <div className="cidades-rodape">
        <span>{cidades.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="cidades-paginacao">
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

export default CidadesPage;
