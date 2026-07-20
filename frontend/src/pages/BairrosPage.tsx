import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarBairros, excluirBairro, Bairro } from "../api/bairros";
import { ItemMenu } from "../api/menu";
import BairroForm from "./BairroForm";
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
import "./BairrosPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "bairro", label: "Bairro" },
  { chave: "cidade", label: "Cidade" },
  { chave: "uf", label: "UF" },
];
const COLUNAS_PADRAO = ["bairro", "cidade", "uf"];

interface BairrosPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  navegarPara: (rota: string, nome: string, grupo: string) => void;
  voltarInicio: () => void;
}

function BairrosPage({ permissoes, navegarPara, voltarInicio }: BairrosPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("bairros", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("bairros"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("bairros", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("bairros", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarBairros(busca || undefined);
      setBairros(dados);
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

  async function handleExcluir(bairro: Bairro) {
    if (!(await confirmar({ mensagem: `Excluir o bairro "${bairro.DescricaoBairro}"?`, perigo: true }))) return;
    try {
      await excluirBairro(bairro.IDBairro);
      carregar();
      mostrarToast("Bairro excluído com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir o bairro", "erro");
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
    return <BairroForm id={idSelecionado} onVoltar={voltarParaLista} navegarPara={navegarPara} />;
  }

  const bairrosOrdenados = ordenarLista(bairros, ordenacao, {
    id: (b) => b.IDBairro,
    bairro: (b) => b.DescricaoBairro,
    cidade: (b) => b.DescricaoCidade || "",
    uf: (b) => b.UF || "",
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Bairro>(COLUNAS, colunasVisiveis, {
    id: (b) => String(b.IDBairro),
    bairro: (b) => b.DescricaoBairro,
    cidade: (b) => b.DescricaoCidade || "-",
    uf: (b) => b.UF || "-",
  });

  const totalPaginas = Math.max(1, Math.ceil(bairrosOrdenados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const bairrosPagina = bairrosOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="bairros-page">
      <div className="bairros-toolbar">
        <button
          type="button"
          className="bairros-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="bairros-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="bairros-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="bairros-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="bairros"
            titulo="Bairros"
            dados={bairrosOrdenados}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="bairros-btn-criar" onClick={abrirCriacao}>
            Criar Bairro
          </button>
        )}
      </div>

      <div className={`bairros-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="bairros-tabela">
          <thead>
            <tr>
              {colunasVisiveis.has("id") && (
                <ThOrdenavel campo="id" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  ID
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("bairro") && (
                <ThOrdenavel campo="bairro" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Bairro
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("cidade") && (
                <ThOrdenavel campo="cidade" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Cidade
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("uf") && (
                <ThOrdenavel
                  campo="uf"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="bairros-col-uf"
                >
                  UF
                </ThOrdenavel>
              )}
              <th className="bairros-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && bairrosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="bairros-vazio">Carregando...</td>
              </tr>
            ) : bairrosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="bairros-vazio">Nenhum bairro encontrado</td>
              </tr>
            ) : (
              bairrosPagina.map((b) => (
                <tr key={b.IDBairro}>
                  {colunasVisiveis.has("id") && <td>{b.IDBairro}</td>}
                  {colunasVisiveis.has("bairro") && <td>{b.DescricaoBairro}</td>}
                  {colunasVisiveis.has("cidade") && <td>{b.DescricaoCidade || "-"}</td>}
                  {colunasVisiveis.has("uf") && <td className="bairros-col-uf">{b.UF || "-"}</td>}
                  <td className="bairros-col-acoes">
                    {podeEditar && (
                      <button
                        className="bairros-icone-acao editar"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => abrirEdicao(b.IDBairro)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        className="bairros-icone-acao perigo"
                        title="Excluir"
                        aria-label="Excluir"
                        onClick={() => handleExcluir(b)}
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

      <div className="bairros-rodape">
        <span>{bairros.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="bairros-paginacao">
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

export default BairrosPage;
