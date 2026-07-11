import { useEffect, useState } from "react";
import { Search, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarFuncionarios, desativarFuncionario, Funcionario } from "../api/funcionarios";
import { ItemMenu } from "../api/menu";
import FuncionarioForm from "./FuncionarioForm";
import "./FuncionariosPage.css";

type SubView = "lista" | "form";

const ITENS_POR_PAGINA = 15;

interface FuncionariosPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  navegarPara: (rota: string, nome: string, grupo: string) => void;
}

function FuncionariosPage({ permissoes, navegarPara }: FuncionariosPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"A" | "I" | "">("A");
  const [pagina, setPagina] = useState(1);

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
    if (!window.confirm(`Desativar o funcionário "${funcionario.NomeFuncionario}"?`)) return;
    await desativarFuncionario(funcionario.IdFuncionario);
    carregar();
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

  const totalPaginas = Math.max(1, Math.ceil(funcionarios.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const funcionariosPagina = funcionarios.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  );

  return (
    <div className="funcionarios-page">
      <div className="funcionarios-toolbar">
        <div className="funcionarios-busca">
          <Search size={16} />
          <input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
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

        {podeAdicionar && (
          <button className="funcionarios-btn-criar" onClick={abrirCriacao}>
            Criar Funcionário
          </button>
        )}
      </div>

      <div className="funcionarios-tabela-wrapper">
        <table className="funcionarios-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Função</th>
              <th>Telefone</th>
              <th className="funcionarios-col-status">Status</th>
              <th className="funcionarios-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={5} className="funcionarios-vazio">Carregando...</td>
              </tr>
            ) : funcionariosPagina.length === 0 ? (
              <tr>
                <td colSpan={5} className="funcionarios-vazio">Nenhum funcionário encontrado</td>
              </tr>
            ) : (
              funcionariosPagina.map((f) => {
                const ativo = f.Situacao.trim() === "A";
                return (
                  <tr key={f.IdFuncionario}>
                    <td>{f.NomeFuncionario}</td>
                    <td>{f.Funcao || "-"}</td>
                    <td>{f.TelCelular || f.TelResidencial || "-"}</td>
                    <td className="funcionarios-col-status">
                      <span className={`funcionarios-badge ${ativo ? "ativo" : "inativo"}`}>
                        {ativo ? "ATIVO" : "INATIVO"}
                      </span>
                    </td>
                    <td className="funcionarios-col-acoes">
                      {podeEditar && (
                        <button
                          className="funcionarios-icone-acao editar"
                          title="Editar"
                          onClick={() => abrirEdicao(f.IdFuncionario)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="funcionarios-icone-acao perigo"
                          title="Desativar"
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
