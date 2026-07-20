import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarFormularios, desativarFormulario, Formulario } from "../api/formularios";
import { ItemMenu } from "../api/menu";
import { getIcone } from "../components/iconRegistry";
import FormularioForm from "./FormularioForm";
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
import "./FormulariosPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "descricao", label: "Descrição" },
  { chave: "nome", label: "Nome" },
  { chave: "grupo", label: "Grupo" },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = ["descricao", "nome", "grupo", "status"];

interface FormulariosPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function FormulariosPage({ permissoes, voltarInicio }: FormulariosPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"A" | "I" | "">("A");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("formularios", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("formularios"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("formularios", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("formularios", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarFormularios(busca || undefined, status || undefined);
      setFormularios(dados);
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

  async function handleExcluir(formulario: Formulario) {
    if (
      !(await confirmar({
        mensagem: `Desativar o formulário "${formulario.Descricao || formulario.NomeFormulario}"?`,
        perigo: true,
      }))
    )
      return;
    try {
      await desativarFormulario(formulario.FormularioID);
      carregar();
      mostrarToast("Formulário desativado com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível desativar o formulário", "erro");
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
    return <FormularioForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const formulariosOrdenados = ordenarLista(formularios, ordenacao, {
    id: (f) => f.FormularioID,
    descricao: (f) => f.Descricao || "",
    nome: (f) => f.NomeFormulario,
    grupo: (f) => f.Grupo || "",
    status: (f) => f.Ativo.trim(),
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Formulario>(COLUNAS, colunasVisiveis, {
    id: (f) => String(f.FormularioID),
    descricao: (f) => f.Descricao || "-",
    nome: (f) => f.NomeFormulario,
    grupo: (f) => f.Grupo || "-",
    status: (f) => (f.Ativo.trim() === "A" ? "ATIVO" : "INATIVO"),
  });

  const totalPaginas = Math.max(1, Math.ceil(formulariosOrdenados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const formulariosPagina = formulariosOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="formularios-page">
      <div className="formularios-toolbar">
        <button
          type="button"
          className="formularios-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="formularios-busca">
          <Search size={16} />
          <input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              className="formularios-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="formularios-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "A" | "I" | "")}
        >
          <option value="A">Ativos</option>
          <option value="I">Inativos</option>
          <option value="">Todos</option>
        </select>

        <div className="formularios-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="formularios"
            titulo="Formulários"
            dados={formulariosOrdenados}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="formularios-btn-criar" onClick={abrirCriacao}>
            Criar Formulário
          </button>
        )}
      </div>

      <div className={`formularios-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="formularios-tabela">
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
              {colunasVisiveis.has("nome") && (
                <ThOrdenavel campo="nome" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Nome
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("grupo") && (
                <ThOrdenavel campo="grupo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Grupo
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("status") && (
                <ThOrdenavel
                  campo="status"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="formularios-col-status"
                >
                  Status
                </ThOrdenavel>
              )}
              <th className="formularios-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && formulariosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="formularios-vazio">Carregando...</td>
              </tr>
            ) : formulariosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="formularios-vazio">Nenhum formulário encontrado</td>
              </tr>
            ) : (
              formulariosPagina.map((f) => {
                const ativo = f.Ativo.trim() === "A";
                const Icone = getIcone(f.Icone);
                return (
                  <tr key={f.FormularioID}>
                    {colunasVisiveis.has("id") && <td>{f.FormularioID}</td>}
                    {colunasVisiveis.has("descricao") && (
                      <td className="formularios-col-descricao">
                        <span className="formularios-descricao-conteudo">
                          <Icone size={16} />
                          {f.Descricao || "-"}
                        </span>
                      </td>
                    )}
                    {colunasVisiveis.has("nome") && <td>{f.NomeFormulario}</td>}
                    {colunasVisiveis.has("grupo") && <td>{f.Grupo || "-"}</td>}
                    {colunasVisiveis.has("status") && (
                      <td className="formularios-col-status">
                        <span className={`formularios-badge ${ativo ? "ativo" : "inativo"}`}>
                          {ativo ? "ATIVO" : "INATIVO"}
                        </span>
                      </td>
                    )}
                    <td className="formularios-col-acoes">
                      {podeEditar && (
                        <button
                          className="formularios-icone-acao editar"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => abrirEdicao(f.FormularioID)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="formularios-icone-acao perigo"
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

      <div className="formularios-rodape">
        <span>{formularios.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="formularios-paginacao">
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

export default FormulariosPage;
