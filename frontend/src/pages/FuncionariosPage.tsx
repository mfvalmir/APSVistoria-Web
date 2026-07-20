import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarFuncionarios, desativarFuncionario, Funcionario } from "../api/funcionarios";
import { ItemMenu } from "../api/menu";
import FuncionarioForm from "./FuncionarioForm";
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
import "./FuncionariosPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "nome", label: "Nome" },
  { chave: "funcao", label: "Função" },
  { chave: "telefone", label: "Telefone" },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = ["nome", "funcao", "telefone", "status"];

interface FuncionariosPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  navegarPara: (rota: string, nome: string, grupo: string) => void;
  voltarInicio: () => void;
}

function FuncionariosPage({ permissoes, navegarPara, voltarInicio }: FuncionariosPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"A" | "I" | "">("A");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("funcionarios", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("funcionarios"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("funcionarios", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("funcionarios", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarFuncionarios(busca || undefined, status || undefined);
      setFuncionarios(dados);
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

  async function handleExcluir(funcionario: Funcionario) {
    if (
      !(await confirmar({ mensagem: `Desativar o funcionário "${funcionario.NomeFuncionario}"?`, perigo: true }))
    )
      return;
    try {
      await desativarFuncionario(funcionario.IdFuncionario);
      carregar();
      mostrarToast("Funcionário desativado com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível desativar o funcionário", "erro");
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
    return <FuncionarioForm id={idSelecionado} onVoltar={voltarParaLista} navegarPara={navegarPara} />;
  }

  const funcionariosOrdenados = ordenarLista(funcionarios, ordenacao, {
    id: (f) => f.IdFuncionario,
    nome: (f) => f.NomeFuncionario,
    funcao: (f) => f.Funcao || "",
    telefone: (f) => f.TelCelular || f.TelResidencial || "",
    status: (f) => f.Situacao.trim(),
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Funcionario>(COLUNAS, colunasVisiveis, {
    id: (f) => String(f.IdFuncionario),
    nome: (f) => f.NomeFuncionario,
    funcao: (f) => f.Funcao || "-",
    telefone: (f) => f.TelCelular || f.TelResidencial || "-",
    status: (f) => (f.Situacao.trim() === "A" ? "ATIVO" : "INATIVO"),
  });

  const totalPaginas = Math.max(1, Math.ceil(funcionariosOrdenados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const funcionariosPagina = funcionariosOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="funcionarios-page">
      <div className="funcionarios-toolbar">
        <button
          type="button"
          className="funcionarios-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="funcionarios-busca">
          <Search size={16} />
          <input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              className="funcionarios-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="funcionarios-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "A" | "I" | "")}
        >
          <option value="A">Ativos</option>
          <option value="I">Inativos</option>
          <option value="">Todos</option>
        </select>

        <div className="funcionarios-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="funcionarios"
            titulo="Funcionários"
            dados={funcionariosOrdenados}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="funcionarios-btn-criar" onClick={abrirCriacao}>
            Criar Funcionário
          </button>
        )}
      </div>

      <div className={`funcionarios-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="funcionarios-tabela">
          <thead>
            <tr>
              {colunasVisiveis.has("id") && (
                <ThOrdenavel campo="id" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  ID
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("nome") && (
                <ThOrdenavel campo="nome" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Nome
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("funcao") && (
                <ThOrdenavel campo="funcao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Função
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("telefone") && (
                <ThOrdenavel campo="telefone" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Telefone
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("status") && (
                <ThOrdenavel
                  campo="status"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="funcionarios-col-status"
                >
                  Status
                </ThOrdenavel>
              )}
              <th className="funcionarios-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && funcionariosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="funcionarios-vazio">Carregando...</td>
              </tr>
            ) : funcionariosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="funcionarios-vazio">Nenhum funcionário encontrado</td>
              </tr>
            ) : (
              funcionariosPagina.map((f) => {
                const ativo = f.Situacao.trim() === "A";
                return (
                  <tr key={f.IdFuncionario}>
                    {colunasVisiveis.has("id") && <td>{f.IdFuncionario}</td>}
                    {colunasVisiveis.has("nome") && <td>{f.NomeFuncionario}</td>}
                    {colunasVisiveis.has("funcao") && <td>{f.Funcao || "-"}</td>}
                    {colunasVisiveis.has("telefone") && <td>{f.TelCelular || f.TelResidencial || "-"}</td>}
                    {colunasVisiveis.has("status") && (
                      <td className="funcionarios-col-status">
                        <span className={`funcionarios-badge ${ativo ? "ativo" : "inativo"}`}>
                          {ativo ? "ATIVO" : "INATIVO"}
                        </span>
                      </td>
                    )}
                    <td className="funcionarios-col-acoes">
                      {podeEditar && (
                        <button
                          className="funcionarios-icone-acao editar"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => abrirEdicao(f.IdFuncionario)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="funcionarios-icone-acao perigo"
                          title="Desativar"
                          aria-label="Desativar"
                          onClick={() => handleExcluir(f)}
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

      <div className="funcionarios-rodape">
        <span>{funcionarios.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="funcionarios-paginacao">
          <button disabled={paginaAtual === 1} onClick={() => setPagina(1)}>
            <ChevronsLeft size={16} />
          </button>
          <button disabled={paginaAtual === 1} onClick={() => setPagina((p) => p - 1)}>
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPaginas }, (_, i) => i + 1)
            .slice(Math.max(0, paginaAtual - 3), paginaAtual + 2)
            .map((p) => (
              <button
                key={p}
                className={p === paginaAtual ? "ativa" : ""}
                onClick={() => setPagina(p)}
              >
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

export default FuncionariosPage;
