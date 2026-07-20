import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarBancos, excluirBanco, Banco } from "../api/banco";
import { ItemMenu } from "../api/menu";
import BancoForm from "./BancoForm";
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
import "./BancoPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "descricao", label: "Descrição" },
];
const COLUNAS_PADRAO = ["descricao"];

interface BancoPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function BancoPage({ permissoes, voltarInicio }: BancoPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [bancos, setBancos] = useState<Banco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("banco", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("banco"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("banco", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("banco", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarBancos(busca || undefined);
      setBancos(dados);
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

  async function handleExcluir(banco: Banco) {
    if (!(await confirmar({ mensagem: `Excluir o banco "${banco.DescricaoBanco}"?`, perigo: true }))) return;
    try {
      await excluirBanco(banco.idBanco);
      carregar();
      mostrarToast("Banco excluído com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível excluir o banco", "erro");
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
    return <BancoForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const bancosOrdenados = ordenarLista(bancos, ordenacao, {
    id: (b) => b.idBanco,
    descricao: (b) => b.DescricaoBanco,
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Banco>(COLUNAS, colunasVisiveis, {
    id: (b) => String(b.idBanco),
    descricao: (b) => b.DescricaoBanco,
  });

  const totalPaginas = Math.max(1, Math.ceil(bancosOrdenados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const bancosPagina = bancosOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="banco-page">
      <div className="banco-toolbar">
        <button
          type="button"
          className="banco-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="banco-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="banco-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="banco-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="bancos"
            titulo="Bancos"
            dados={bancosOrdenados}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="banco-btn-criar" onClick={abrirCriacao}>
            Criar Banco
          </button>
        )}
      </div>

      <div className={`banco-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="banco-tabela">
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
              <th className="banco-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && bancosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="banco-vazio">Carregando...</td>
              </tr>
            ) : bancosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="banco-vazio">Nenhum banco encontrado</td>
              </tr>
            ) : (
              bancosPagina.map((b) => (
                <tr key={b.idBanco}>
                  {colunasVisiveis.has("id") && <td>{b.idBanco}</td>}
                  {colunasVisiveis.has("descricao") && <td>{b.DescricaoBanco}</td>}
                  <td className="banco-col-acoes">
                    {podeEditar && (
                      <button
                        className="banco-icone-acao editar"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => abrirEdicao(b.idBanco)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        className="banco-icone-acao perigo"
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

      <div className="banco-rodape">
        <span>{bancos.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="banco-paginacao">
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

export default BancoPage;
