import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarFornecedores, desativarFornecedor, Fornecedor } from "../api/fornecedores";
import { ItemMenu } from "../api/menu";
import FornecedorForm from "./FornecedorForm";
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
import "./FornecedorPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "razaoSocial", label: "Razão Social" },
  { chave: "nomeFantasia", label: "Nome Fantasia" },
  { chave: "documento", label: "CPF/CNPJ" },
  { chave: "telefone", label: "Telefone" },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = ["razaoSocial", "nomeFantasia", "documento", "telefone", "status"];

// Fornecedor não tem coluna TipoPessoa (diferente de Cliente) - o formato é decidido
// pela quantidade de dígitos armazenados (11 = CPF, 14 = CNPJ).
function formatarCpfCnpjExibicao(valor: string): string {
  const d = valor.replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return valor;
}

interface FornecedorPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function FornecedorPage({ permissoes, voltarInicio }: FornecedorPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"A" | "I" | "">("A");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("fornecedores", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("fornecedores"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("fornecedores", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("fornecedores", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarFornecedores(busca || undefined, status || undefined);
      setFornecedores(dados);
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

  async function handleExcluir(fornecedor: Fornecedor) {
    if (!(await confirmar({ mensagem: `Desativar o fornecedor "${fornecedor.RazaoSocial}"?`, perigo: true })))
      return;
    try {
      await desativarFornecedor(fornecedor.idFornecedor);
      carregar();
      mostrarToast("Fornecedor desativado com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível desativar o fornecedor", "erro");
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
    return <FornecedorForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const fornecedoresOrdenados = ordenarLista(fornecedores, ordenacao, {
    id: (f) => f.idFornecedor,
    razaoSocial: (f) => f.RazaoSocial,
    nomeFantasia: (f) => f.NomeFantasia || "",
    documento: (f) => f.CpfCnpj || "",
    telefone: (f) => f.Telefone || "",
    status: (f) => f.Ativo.trim(),
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Fornecedor>(COLUNAS, colunasVisiveis, {
    id: (f) => String(f.idFornecedor),
    razaoSocial: (f) => f.RazaoSocial,
    nomeFantasia: (f) => f.NomeFantasia || "-",
    documento: (f) => (f.CpfCnpj ? formatarCpfCnpjExibicao(f.CpfCnpj) : "-"),
    telefone: (f) => f.Telefone || "-",
    status: (f) => (f.Ativo.trim() === "A" ? "ATIVO" : "INATIVO"),
  });

  const totalPaginas = Math.max(1, Math.ceil(fornecedoresOrdenados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const fornecedoresPagina = fornecedoresOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="fornecedores-page">
      <div className="fornecedores-toolbar">
        <button
          type="button"
          className="fornecedores-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="fornecedores-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="fornecedores-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="fornecedores-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "A" | "I" | "")}
        >
          <option value="A">Ativos</option>
          <option value="I">Inativos</option>
          <option value="">Todos</option>
        </select>

        <div className="fornecedores-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="fornecedores"
            titulo="Fornecedores"
            dados={fornecedoresOrdenados}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="fornecedores-btn-criar" onClick={abrirCriacao}>
            Criar Fornecedor
          </button>
        )}
      </div>

      <div className={`fornecedores-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="fornecedores-tabela">
          <thead>
            <tr>
              {colunasVisiveis.has("id") && (
                <ThOrdenavel campo="id" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  ID
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("razaoSocial") && (
                <ThOrdenavel campo="razaoSocial" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Razão Social
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("nomeFantasia") && (
                <ThOrdenavel campo="nomeFantasia" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Nome Fantasia
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("documento") && (
                <ThOrdenavel campo="documento" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  CPF/CNPJ
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
                  className="fornecedores-col-status"
                >
                  Status
                </ThOrdenavel>
              )}
              <th className="fornecedores-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && fornecedoresPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="fornecedores-vazio">Carregando...</td>
              </tr>
            ) : fornecedoresPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="fornecedores-vazio">Nenhum fornecedor encontrado</td>
              </tr>
            ) : (
              fornecedoresPagina.map((f) => {
                const ativo = f.Ativo.trim() === "A";
                return (
                  <tr key={f.idFornecedor}>
                    {colunasVisiveis.has("id") && <td>{f.idFornecedor}</td>}
                    {colunasVisiveis.has("razaoSocial") && <td>{f.RazaoSocial}</td>}
                    {colunasVisiveis.has("nomeFantasia") && <td>{f.NomeFantasia || "-"}</td>}
                    {colunasVisiveis.has("documento") && (
                      <td>{f.CpfCnpj ? formatarCpfCnpjExibicao(f.CpfCnpj) : "-"}</td>
                    )}
                    {colunasVisiveis.has("telefone") && <td>{f.Telefone || "-"}</td>}
                    {colunasVisiveis.has("status") && (
                      <td className="fornecedores-col-status">
                        <span className={`fornecedores-badge ${ativo ? "ativo" : "inativo"}`}>
                          {ativo ? "ATIVO" : "INATIVO"}
                        </span>
                      </td>
                    )}
                    <td className="fornecedores-col-acoes">
                      {podeEditar && (
                        <button
                          className="fornecedores-icone-acao editar"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => abrirEdicao(f.idFornecedor)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="fornecedores-icone-acao perigo"
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

      <div className="fornecedores-rodape">
        <span>{fornecedores.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="fornecedores-paginacao">
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

export default FornecedorPage;
