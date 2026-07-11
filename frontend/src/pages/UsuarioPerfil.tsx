import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft } from "lucide-react";
import {
  buscarPermissoes,
  concederPermissoes,
  removerPermissao,
  alternarPermissao,
  ArvorePermissoes,
  CampoPermissao,
} from "../api/permissoes";
import "./UsuarioPerfil.css";

interface UsuarioPerfilProps {
  usuarioId: number;
  onVoltar: () => void;
}

function UsuarioPerfil({ usuarioId, onVoltar }: UsuarioPerfilProps) {
  const [arvore, setArvore] = useState<ArvorePermissoes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionadosDisponiveis, setSelecionadosDisponiveis] = useState<Set<number>>(new Set());
  const [selecionadosRepassados, setSelecionadosRepassados] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState("");

  function mensagemErro(err: unknown, padrao: string): string {
    if (isAxiosError(err) && err.response) {
      return err.response.data?.erro || padrao;
    }
    return "Não foi possível conectar ao servidor. Tente novamente.";
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await buscarPermissoes(usuarioId);
      setArvore(dados);
      setSelecionadosDisponiveis(new Set());
      setSelecionadosRepassados(new Set());
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível carregar as permissões"));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  function alternarSelecao(conjunto: Set<number>, id: number, setConjunto: (s: Set<number>) => void) {
    const novo = new Set(conjunto);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setConjunto(novo);
  }

  async function handleAdicionar() {
    if (selecionadosDisponiveis.size === 0) return;
    setErro("");
    try {
      await concederPermissoes(usuarioId, Array.from(selecionadosDisponiveis));
      await carregar();
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível repassar as aplicações selecionadas"));
    }
  }

  async function handleRemover() {
    if (selecionadosRepassados.size === 0) return;
    setErro("");
    try {
      await Promise.all(
        Array.from(selecionadosRepassados).map((formularioId) => removerPermissao(usuarioId, formularioId))
      );
      await carregar();
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível remover as aplicações selecionadas"));
      carregar();
    }
  }

  async function handleToggleFlag(formularioId: number, campo: CampoPermissao, valorAtual: boolean) {
    if (!arvore) return;
    const novoValor = !valorAtual;
    setErro("");
    setArvore({
      ...arvore,
      repassadas: arvore.repassadas.map((item) =>
        item.formularioId === formularioId ? { ...item, [campo]: novoValor } : item
      ),
    });
    try {
      await alternarPermissao(usuarioId, formularioId, campo, novoValor);
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível atualizar a permissão"));
      carregar();
    }
  }

  async function handleToggleColuna(campo: CampoPermissao) {
    if (!arvore || arvore.repassadas.length === 0) return;
    const todosMarcados = arvore.repassadas.every((item) => item[campo]);
    const novoValor = !todosMarcados;
    setErro("");
    setArvore({
      ...arvore,
      repassadas: arvore.repassadas.map((item) => ({ ...item, [campo]: novoValor })),
    });
    try {
      await Promise.all(
        arvore.repassadas.map((item) => alternarPermissao(usuarioId, item.formularioId, campo, novoValor))
      );
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível atualizar a permissão de todos os itens"));
      carregar();
    }
  }

  if (carregando || !arvore) {
    return <div className="usuario-perfil-pagina">Carregando...</div>;
  }

  return (
    <div className="usuario-perfil-pagina">
      <div className="usuario-perfil-cabecalho">
        <button className="usuario-perfil-voltar" onClick={onVoltar} type="button">
          <ArrowLeft size={18} />
        </button>
        <h2>Perfil de Usuário</h2>
        <div className="usuario-perfil-info">
          <div>
            <span className="usuario-perfil-info-label">Código</span>
            <span>{String(arvore.usuario.idUser).padStart(6, "0")}</span>
          </div>
          <div>
            <span className="usuario-perfil-info-label">Funcionário</span>
            <span>{arvore.usuario.nomeFuncionario || "-"}</span>
          </div>
          <div>
            <span className="usuario-perfil-info-label">Login</span>
            <span>{arvore.usuario.login}</span>
          </div>
        </div>
      </div>

      {erro && <div className="usuario-perfil-erro">{erro}</div>}

      <div className="usuario-perfil-colunas">
        <div className="usuario-perfil-coluna">
          <div className="usuario-perfil-coluna-titulo">Aplicações disponíveis para repasse</div>
          <div className="usuario-perfil-lista">
            {arvore.disponiveis.length === 0 ? (
              <div className="usuario-perfil-vazio">Todas as aplicações já foram repassadas.</div>
            ) : (
              arvore.disponiveis.map((item) => (
                <label key={item.formularioId} className="usuario-perfil-item">
                  <input
                    type="checkbox"
                    checked={selecionadosDisponiveis.has(item.formularioId)}
                    onChange={() =>
                      alternarSelecao(selecionadosDisponiveis, item.formularioId, setSelecionadosDisponiveis)
                    }
                  />
                  {item.descricao}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="usuario-perfil-acoes">
          <button onClick={handleAdicionar} disabled={selecionadosDisponiveis.size === 0}>
            Adicionar &gt;
          </button>
          <button onClick={handleRemover} disabled={selecionadosRepassados.size === 0}>
            &lt; Remover
          </button>
        </div>

        <div className="usuario-perfil-coluna">
          <div className="usuario-perfil-coluna-titulo usuario-perfil-coluna-titulo-repasse">
            <span>Aplicações repassadas</span>
          </div>
          <div className="usuario-perfil-lista">
            <div className="usuario-perfil-flags-cabecalho">
              <span className="usuario-perfil-flags-cabecalho-nome"></span>
              <span className="usuario-perfil-flags">
                <span title="Clique para marcar/desmarcar todos" onClick={() => handleToggleColuna("acessoFormulario")}>
                  Acessar
                </span>
                <span title="Clique para marcar/desmarcar todos" onClick={() => handleToggleColuna("podeAdicionar")}>
                  Adicionar
                </span>
                <span title="Clique para marcar/desmarcar todos" onClick={() => handleToggleColuna("podeEditar")}>
                  Editar
                </span>
                <span title="Clique para marcar/desmarcar todos" onClick={() => handleToggleColuna("podeExcluir")}>
                  Excluir
                </span>
                <span title="Clique para marcar/desmarcar todos" onClick={() => handleToggleColuna("podeImprimir")}>
                  Imprimir
                </span>
                <span
                  title="Clique para marcar/desmarcar todos"
                  onClick={() => handleToggleColuna("podeBaixarParCP")}
                >
                  Baixar C.P.
                </span>
                <span
                  title="Clique para marcar/desmarcar todos"
                  onClick={() => handleToggleColuna("podeEstornarParCP")}
                >
                  Estornar C.P.
                </span>
                <span
                  title="Clique para marcar/desmarcar todos"
                  onClick={() => handleToggleColuna("podeBaixarParCR")}
                >
                  Baixar C.R.
                </span>
                <span
                  title="Clique para marcar/desmarcar todos"
                  onClick={() => handleToggleColuna("podeEstornarParCR")}
                >
                  Estornar C.R.
                </span>
              </span>
            </div>
            {arvore.repassadas.length === 0 ? (
              <div className="usuario-perfil-vazio">Nenhuma aplicação repassada.</div>
            ) : (
              arvore.repassadas.map((item) => (
                <div key={item.formularioId} className="usuario-perfil-item usuario-perfil-item-repasse">
                  <label className="usuario-perfil-item-nome">
                    <input
                      type="checkbox"
                      checked={selecionadosRepassados.has(item.formularioId)}
                      onChange={() =>
                        alternarSelecao(selecionadosRepassados, item.formularioId, setSelecionadosRepassados)
                      }
                    />
                    {item.descricao}
                  </label>
                  <span className="usuario-perfil-flags">
                    <input
                      type="checkbox"
                      title="Acessar Formulário"
                      checked={item.acessoFormulario}
                      onChange={() => handleToggleFlag(item.formularioId, "acessoFormulario", item.acessoFormulario)}
                    />
                    <input
                      type="checkbox"
                      title="Adicionar Registro"
                      checked={item.podeAdicionar}
                      onChange={() => handleToggleFlag(item.formularioId, "podeAdicionar", item.podeAdicionar)}
                    />
                    <input
                      type="checkbox"
                      title="Editar Registro"
                      checked={item.podeEditar}
                      onChange={() => handleToggleFlag(item.formularioId, "podeEditar", item.podeEditar)}
                    />
                    <input
                      type="checkbox"
                      title="Excluir Registro"
                      checked={item.podeExcluir}
                      onChange={() => handleToggleFlag(item.formularioId, "podeExcluir", item.podeExcluir)}
                    />
                    <input
                      type="checkbox"
                      title="Imprimir Relatório"
                      checked={item.podeImprimir}
                      onChange={() => handleToggleFlag(item.formularioId, "podeImprimir", item.podeImprimir)}
                    />
                    <input
                      type="checkbox"
                      title="Baixar Parcela Conta Pagar"
                      checked={item.podeBaixarParCP}
                      onChange={() => handleToggleFlag(item.formularioId, "podeBaixarParCP", item.podeBaixarParCP)}
                    />
                    <input
                      type="checkbox"
                      title="Estornar Parcela Conta Pagar"
                      checked={item.podeEstornarParCP}
                      onChange={() =>
                        handleToggleFlag(item.formularioId, "podeEstornarParCP", item.podeEstornarParCP)
                      }
                    />
                    <input
                      type="checkbox"
                      title="Baixar Parcela Conta Receber"
                      checked={item.podeBaixarParCR}
                      onChange={() => handleToggleFlag(item.formularioId, "podeBaixarParCR", item.podeBaixarParCR)}
                    />
                    <input
                      type="checkbox"
                      title="Estornar Parcela Conta Receber"
                      checked={item.podeEstornarParCR}
                      onChange={() =>
                        handleToggleFlag(item.formularioId, "podeEstornarParCR", item.podeEstornarParCR)
                      }
                    />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UsuarioPerfil;
