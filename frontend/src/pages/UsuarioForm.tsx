import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Eye, EyeOff, KeyRound, Send } from "lucide-react";
import { obterUsuario, criarUsuario, atualizarUsuario } from "../api/usuarios";
import { buscarFuncionarios, FuncionarioResumo } from "../api/funcionarios";
import { focarProximoCampoAoEnter } from "../utils/form";
import { useToast } from "../contexts/ToastContext";
import "./UsuarioForm.css";

interface UsuarioFormProps {
  id: number | null;
  onVoltar: () => void;
  onAlterarSenha?: () => void;
}

function UsuarioForm({ id, onVoltar, onAlterarSenha }: UsuarioFormProps) {
  const modoEdicao = id !== null;

  const [login, setLogin] = useState("");
  const [status, setStatus] = useState<"A" | "I">("A");
  const [administrador, setAdministrador] = useState(false);

  const [idFuncionario, setIdFuncionario] = useState<number | null>(null);
  const [nomeFuncionario, setNomeFuncionario] = useState("");
  const [sugestoes, setSugestoes] = useState<FuncionarioResumo[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterUsuario(id)
      .then((u) => {
        setLogin(u.Loginn);
        setStatus(u.Situacao.trim() === "I" ? "I" : "A");
        setAdministrador(u.Administrador.trim() === "S");
        setIdFuncionario(u.IDFuncionario);
        setNomeFuncionario(u.NomeFuncionario || "");
      })
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  useEffect(() => {
    if (modoEdicao) return;
    if (nomeFuncionario.trim().length < 2) {
      setSugestoes([]);
      return;
    }
    const timeout = setTimeout(() => {
      buscarFuncionarios(nomeFuncionario, { semUsuario: true }).then(setSugestoes);
    }, 250);
    return () => clearTimeout(timeout);
  }, [nomeFuncionario, modoEdicao]);

  function selecionarFuncionario(f: FuncionarioResumo) {
    setIdFuncionario(f.IdFuncionario);
    setNomeFuncionario(f.NomeFuncionario);
    setSugestoes([]);
    setMostrarSugestoes(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!login.trim()) novosErros.login = "Informe o nome de usuário";
    if (!modoEdicao) {
      if (!idFuncionario) novosErros.idFuncionario = "Selecione um funcionário na lista";
      if (!senha) novosErros.senha = "Informe a senha";
      if (senha && confirmarSenha && senha !== confirmarSenha) novosErros.confirmarSenha = "As senhas não conferem";
      if (!confirmarSenha && senha) novosErros.confirmarSenha = "Confirme a senha";
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarUsuario(id, { login, status, administrador });
        mostrarToast("Usuário atualizado com sucesso", "sucesso");
      } else {
        await criarUsuario({ idFuncionario: idFuncionario!, login, senha, administrador });
        mostrarToast("Usuário criado com sucesso", "sucesso");
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o usuário");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <div className="usuario-form-pagina">Carregando...</div>;
  }

  return (
    <div className="usuario-form-pagina">
      <div className="usuario-form-cabecalho">
        <button className="usuario-form-voltar" onClick={onVoltar} type="button">
          <ArrowLeft size={18} />
        </button>
        <h2>{modoEdicao ? "Editar Usuário" : "Novo Usuário"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.login ? "campo-invalido" : ""}`}>
            <label htmlFor="uf-login">
              Nome de usuário <span className="obrigatorio">*</span>
            </label>
            <input
              id="uf-login"
              value={login}
              onChange={(e) => {
                setLogin(e.target.value);
                if (erros.login) setErros((atual) => ({ ...atual, login: "" }));
              }}
              placeholder="Digite o nome de usuário"
              required
            />
            {erros.login && <span className="usuario-form-campo-erro">{erros.login}</span>}
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="uf-status">
              Status <span className="obrigatorio">*</span>
            </label>
            <select id="uf-status" value={status} onChange={(e) => setStatus(e.target.value as "A" | "I")}>
              <option value="A">Ativo</option>
              <option value="I">Inativo</option>
            </select>
          </div>
        </div>

        <div className={`usuario-form-campo usuario-form-combobox ${erros.idFuncionario ? "campo-invalido" : ""}`}>
          <label htmlFor="uf-funcionario">Nome do Funcionário</label>
          <input
            id="uf-funcionario"
            value={nomeFuncionario}
            onChange={(e) => {
              setNomeFuncionario(e.target.value);
              setIdFuncionario(null);
              setMostrarSugestoes(true);
              if (erros.idFuncionario) setErros((atual) => ({ ...atual, idFuncionario: "" }));
            }}
            onFocus={() => setMostrarSugestoes(true)}
            onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
            placeholder="Digite o nome para buscar..."
            disabled={modoEdicao}
            autoComplete="off"
          />
          {mostrarSugestoes && sugestoes.length > 0 && (
            <ul className="usuario-form-sugestoes">
              {sugestoes.map((f) => (
                <li key={f.IdFuncionario} onMouseDown={() => selecionarFuncionario(f)}>
                  {f.NomeFuncionario}
                </li>
              ))}
            </ul>
          )}
          {erros.idFuncionario && <span className="usuario-form-campo-erro">{erros.idFuncionario}</span>}
        </div>

        {modoEdicao ? (
          <button type="button" className="usuario-form-btn-alterar-senha" onClick={onAlterarSenha}>
            <KeyRound size={16} />
            Alterar Senha
          </button>
        ) : (
          <div className="usuario-form-linha">
            <div className={`usuario-form-campo ${erros.senha ? "campo-invalido" : ""}`}>
              <label htmlFor="uf-senha">
                Senha <span className="obrigatorio">*</span>
              </label>
              <div className="usuario-form-senha-wrapper">
                <input
                  id="uf-senha"
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    if (erros.senha) setErros((atual) => ({ ...atual, senha: "" }));
                  }}
                  placeholder="Digite a senha"
                  required
                />
                <button type="button" onClick={() => setMostrarSenha((v) => !v)}>
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {erros.senha && <span className="usuario-form-campo-erro">{erros.senha}</span>}
            </div>

            <div className={`usuario-form-campo ${erros.confirmarSenha ? "campo-invalido" : ""}`}>
              <label htmlFor="uf-confirmar-senha">
                Confirmar Senha <span className="obrigatorio">*</span>
              </label>
              <div className="usuario-form-senha-wrapper">
                <input
                  id="uf-confirmar-senha"
                  type={mostrarSenha ? "text" : "password"}
                  value={confirmarSenha}
                  onChange={(e) => {
                    setConfirmarSenha(e.target.value);
                    if (erros.confirmarSenha) setErros((atual) => ({ ...atual, confirmarSenha: "" }));
                  }}
                  placeholder="Repita a senha"
                  required
                />
              </div>
              {erros.confirmarSenha && <span className="usuario-form-campo-erro">{erros.confirmarSenha}</span>}
            </div>
          </div>
        )}

        <div className="usuario-form-permissoes">
          <span className="usuario-form-permissoes-titulo">Permissões</span>
          <label className="usuario-form-toggle">
            <input
              type="checkbox"
              checked={administrador}
              onChange={(e) => setAdministrador(e.target.checked)}
            />
            Administrador
          </label>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Usuário"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default UsuarioForm;
