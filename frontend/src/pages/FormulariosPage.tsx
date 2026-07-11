import { useEffect, useState } from "react";
import { Search, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarFormularios, desativarFormulario, Formulario } from "../api/formularios";
import { ItemMenu } from "../api/menu";
import { getIcone } from "../components/iconRegistry";
import FormularioForm from "./FormularioForm";
import "./FormulariosPage.css";

type SubView = "lista" | "form";

const ITENS_POR_PAGINA = 15;

interface FormulariosPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
}

function FormulariosPage({ permissoes }: FormulariosPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"A" | "I" | "">("A");
  const [pagina, setPagina] = useState(1);

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
    if (!window.confirm(`Desativar o formulário "${formulario.Descricao || formulario.NomeFormulario}"?`)) return;
    await desativarFormulario(formulario.FormularioID);
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
    return <FormularioForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const totalPaginas = Math.max(1, Math.ceil(formularios.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const formulariosPagina = formularios.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  );

  return (
    <div className="formularios-page">
      <div className="formularios-toolbar">
        <div className="formularios-busca">
          <Search size={16} />
          <input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
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

        {podeAdicionar && (
          <button className="formularios-btn-criar" onClick={abrirCriacao}>
            Criar Formulário
          </button>
        )}
      </div>

      <div className="formularios-tabela-wrapper">
        <table className="formularios-tabela">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Nome</th>
              <th>Grupo</th>
              <th className="formularios-col-status">Status</th>
              <th className="formularios-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={5} className="formularios-vazio">Carregando...</td>
              </tr>
            ) : formulariosPagina.length === 0 ? (
              <tr>
                <td colSpan={5} className="formularios-vazio">Nenhum formulário encontrado</td>
              </tr>
            ) : (
              formulariosPagina.map((f) => {
                const ativo = f.Ativo.trim() === "A";
                const Icone = getIcone(f.Icone);
                return (
                  <tr key={f.FormularioID}>
                    <td className="formularios-col-descricao">
                      <Icone size={16} />
                      {f.Descricao || "-"}
                    </td>
                    <td>{f.NomeFormulario}</td>
                    <td>{f.Grupo || "-"}</td>
                    <td className="formularios-col-status">
                      <span className={`formularios-badge ${ativo ? "ativo" : "inativo"}`}>
                        {ativo ? "ATIVO" : "INATIVO"}
                      </span>
                    </td>
                    <td className="formularios-col-acoes">
                      {podeEditar && (
                        <button
                          className="formularios-icone-acao editar"
                          title="Editar"
                          onClick={() => abrirEdicao(f.FormularioID)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="formularios-icone-acao perigo"
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

      <div className="formularios-rodape">
        <span>{formularios.length} registros</span>
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
