import { Fragment, useEffect, useState } from "react";
import {
  ArrowLeft,
  Search,
  X,
  ShieldCheck,
  Pencil,
  Trash2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ChevronDown,
  Check,
} from "lucide-react";
import { listarUsuarios, desativarUsuario, Usuario } from "../api/usuarios";
import { buscarPermissoes, AplicacaoRepassada } from "../api/permissoes";
import { ItemMenu } from "../api/menu";
import UsuarioForm from "./UsuarioForm";
import UsuarioPerfil from "./UsuarioPerfil";
import UsuarioSenha from "./UsuarioSenha";
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import "./UsuariosPage.css";

type SubView = "lista" | "form" | "perfil" | "senha";

const ITENS_POR_PAGINA = 15;

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "usuario", label: "Usuário" },
  { chave: "funcionario", label: "Funcionário" },
  { chave: "funcao", label: "Função" },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = ["usuario", "funcionario", "funcao", "status"];

interface UsuariosPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function UsuariosPage({ permissoes, administrador, voltarInicio }: UsuariosPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"A" | "I" | "">("A");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("usuarios", COLUNAS_PADRAO)
  );

  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [permissoesPorUsuario, setPermissoesPorUsuario] = useState<Record<number, AplicacaoRepassada[]>>({});
  const [carregandoPermissoes, setCarregandoPermissoes] = useState<Set<number>>(new Set());

  async function alternarExpandir(idUser: number) {
    const estavaExpandido = expandidos.has(idUser);
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (estavaExpandido) novo.delete(idUser);
      else novo.add(idUser);
      return novo;
    });

    if (estavaExpandido || permissoesPorUsuario[idUser]) return;

    setCarregandoPermissoes((atual) => new Set(atual).add(idUser));
    try {
      const dados = await buscarPermissoes(idUser);
      setPermissoesPorUsuario((atual) => ({ ...atual, [idUser]: dados.repassadas }));
    } finally {
      setCarregandoPermissoes((atual) => {
        const novo = new Set(atual);
        novo.delete(idUser);
        return novo;
      });
    }
  }

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("usuarios", novo);
      return novo;
    });
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarUsuarios(busca || undefined, status || undefined);
      setUsuarios(dados);
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

  async function handleExcluir(usuario: Usuario) {
    if (!window.confirm(`Desativar o usuário "${usuario.Loginn}"?`)) return;
    await desativarUsuario(usuario.IDUser);
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

  function abrirPerfil(id: number) {
    setIdSelecionado(id);
    setSubView("perfil");
  }

  function voltarParaLista() {
    setSubView("lista");
    carregar();
  }

  if (subView === "form") {
    return (
      <UsuarioForm
        id={idSelecionado}
        onVoltar={voltarParaLista}
        onAlterarSenha={() => setSubView("senha")}
      />
    );
  }

  if (subView === "senha" && idSelecionado !== null) {
    return <UsuarioSenha id={idSelecionado} onVoltar={() => setSubView("form")} />;
  }

  if (subView === "perfil" && idSelecionado !== null) {
    return <UsuarioPerfil usuarioId={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const totalPaginas = Math.max(1, Math.ceil(usuarios.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const usuariosPagina = usuarios.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  );

  return (
    <div className="usuarios-page">
      <div className="usuarios-toolbar">
        <button
          type="button"
          className="usuarios-btn-voltar"
          title="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="usuarios-busca">
          <Search size={16} />
          <input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              className="usuarios-busca-limpar"
              title="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="usuarios-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "A" | "I" | "")}
        >
          <option value="A">Ativos</option>
          <option value="I">Inativos</option>
          <option value="">Todos</option>
        </select>

        <div className="usuarios-toolbar-espaco" />

        {podeAdicionar && (
          <button className="usuarios-btn-criar" onClick={abrirCriacao}>
            Criar Usuário
          </button>
        )}
      </div>

      <div className="usuarios-tabela-wrapper">
        <table className="usuarios-tabela">
          <thead>
            <tr>
              <th className="usuarios-col-expandir"></th>
              {colunasVisiveis.has("id") && <th>ID</th>}
              {colunasVisiveis.has("usuario") && <th>Usuário</th>}
              {colunasVisiveis.has("funcionario") && <th>Funcionário</th>}
              {colunasVisiveis.has("funcao") && <th>Função</th>}
              {colunasVisiveis.has("status") && <th className="usuarios-col-status">Status</th>}
              <th className="usuarios-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="usuarios-vazio">Carregando...</td>
              </tr>
            ) : usuariosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 2} className="usuarios-vazio">Nenhum usuário encontrado</td>
              </tr>
            ) : (
              usuariosPagina.map((u) => {
                const ativo = u.Situacao.trim() === "A";
                const expandido = expandidos.has(u.IDUser);
                const permissoesUsuario = permissoesPorUsuario[u.IDUser];
                return (
                  <Fragment key={u.IDUser}>
                  <tr>
                    <td className="usuarios-col-expandir">
                      <button
                        type="button"
                        className={`usuarios-btn-expandir ${expandido ? "aberto" : ""}`}
                        title={expandido ? "Ocultar permissões" : "Ver permissões"}
                        onClick={() => alternarExpandir(u.IDUser)}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </td>
                    {colunasVisiveis.has("id") && <td>{u.IDUser}</td>}
                    {colunasVisiveis.has("usuario") && <td>{u.Loginn}</td>}
                    {colunasVisiveis.has("funcionario") && <td>{u.NomeFuncionario || "-"}</td>}
                    {colunasVisiveis.has("funcao") && <td>{u.Funcao || "-"}</td>}
                    {colunasVisiveis.has("status") && (
                      <td className="usuarios-col-status">
                        <span className={`usuarios-badge ${ativo ? "ativo" : "inativo"}`}>
                          {ativo ? "ATIVO" : "INATIVO"}
                        </span>
                      </td>
                    )}
                    <td className="usuarios-col-acoes">
                      {administrador && (
                        <button
                          className="usuarios-icone-acao perfil"
                          title="Perfil de permissões"
                          onClick={() => abrirPerfil(u.IDUser)}
                        >
                          <ShieldCheck size={16} />
                        </button>
                      )}
                      {podeEditar && (
                        <button
                          className="usuarios-icone-acao editar"
                          title="Editar"
                          onClick={() => abrirEdicao(u.IDUser)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="usuarios-icone-acao perigo"
                          title="Desativar"
                          onClick={() => handleExcluir(u)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandido && (
                    <tr className="usuarios-linha-expandida">
                      <td colSpan={colunasVisiveis.size + 2} className="usuarios-permissoes-celula">
                        {carregandoPermissoes.has(u.IDUser) ? (
                          <div className="usuarios-permissoes-estado">Carregando permissões...</div>
                        ) : !permissoesUsuario || permissoesUsuario.length === 0 ? (
                          <div className="usuarios-permissoes-estado">Nenhuma permissão repassada.</div>
                        ) : (
                          <div className="usuarios-permissoes-tabela-wrapper">
                            <table className="usuarios-permissoes-tabela">
                              <thead>
                                <tr>
                                  <th>Formulário</th>
                                  <th>Grupo</th>
                                  <th title="Acessar">Ac.</th>
                                  <th title="Adicionar">Ad.</th>
                                  <th title="Editar">Ed.</th>
                                  <th title="Excluir">Ex.</th>
                                  <th title="Imprimir">Imp.</th>
                                  <th title="Baixar Conta a Pagar">B.CP</th>
                                  <th title="Estornar Conta a Pagar">E.CP</th>
                                  <th title="Baixar Conta a Receber">B.CR</th>
                                  <th title="Estornar Conta a Receber">E.CR</th>
                                </tr>
                              </thead>
                              <tbody>
                                {permissoesUsuario.map((item) => (
                                  <tr key={item.formularioId}>
                                    <td>{item.descricao}</td>
                                    <td>{item.grupo || "-"}</td>
                                    <td className="usuarios-col-flag">{item.acessoFormulario && <Check size={14} />}</td>
                                    <td className="usuarios-col-flag">{item.podeAdicionar && <Check size={14} />}</td>
                                    <td className="usuarios-col-flag">{item.podeEditar && <Check size={14} />}</td>
                                    <td className="usuarios-col-flag">{item.podeExcluir && <Check size={14} />}</td>
                                    <td className="usuarios-col-flag">{item.podeImprimir && <Check size={14} />}</td>
                                    <td className="usuarios-col-flag">{item.podeBaixarParCP && <Check size={14} />}</td>
                                    <td className="usuarios-col-flag">{item.podeEstornarParCP && <Check size={14} />}</td>
                                    <td className="usuarios-col-flag">{item.podeBaixarParCR && <Check size={14} />}</td>
                                    <td className="usuarios-col-flag">{item.podeEstornarParCR && <Check size={14} />}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="usuarios-rodape">
        <span>{usuarios.length} registros</span>
        <div className="usuarios-paginacao">
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

export default UsuariosPage;
