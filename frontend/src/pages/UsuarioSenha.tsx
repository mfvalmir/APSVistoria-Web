import { useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Eye, EyeOff, Send } from "lucide-react";
import { alterarSenha } from "../api/usuarios";
import { focarProximoCampoAoEnter } from "../utils/form";
import "./UsuarioForm.css";

interface UsuarioSenhaProps {
  id: number;
  onVoltar: () => void;
}

function UsuarioSenha({ id, onVoltar }: UsuarioSenhaProps) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!senhaAtual) novosErros.senhaAtual = "Informe a senha atual";
    if (!novaSenha) novosErros.novaSenha = "Informe a nova senha";
    if (novaSenha && confirmarNovaSenha && novaSenha !== confirmarNovaSenha) {
      novosErros.confirmarNovaSenha = "As senhas não conferem";
    } else if (novaSenha && !confirmarNovaSenha) {
      novosErros.confirmarNovaSenha = "Confirme a nova senha";
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      await alterarSenha(id, { senhaAtual, novaSenha });
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível alterar a senha");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="usuario-form-pagina">
      <div className="usuario-form-cabecalho">
        <button className="usuario-form-voltar" onClick={onVoltar} type="button">
          <ArrowLeft size={18} />
        </button>
        <h2>Alterar Senha</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.senhaAtual ? "campo-invalido" : ""}`}>
            <label htmlFor="us-senha-atual">
              Senha atual <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-senha-wrapper">
              <input
                id="us-senha-atual"
                type={mostrarSenha ? "text" : "password"}
                value={senhaAtual}
                onChange={(e) => {
                  setSenhaAtual(e.target.value);
                  if (erros.senhaAtual) setErros((atual) => ({ ...atual, senhaAtual: "" }));
                }}
                placeholder="Digite a senha atual"
                required
              />
              <button type="button" onClick={() => setMostrarSenha((v) => !v)}>
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {erros.senhaAtual && <span className="usuario-form-campo-erro">{erros.senhaAtual}</span>}
          </div>

          <div className={`usuario-form-campo ${erros.novaSenha ? "campo-invalido" : ""}`}>
            <label htmlFor="us-nova-senha">
              Nova senha <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-senha-wrapper">
              <input
                id="us-nova-senha"
                type={mostrarNovaSenha ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => {
                  setNovaSenha(e.target.value);
                  if (erros.novaSenha) setErros((atual) => ({ ...atual, novaSenha: "" }));
                }}
                placeholder="Digite a nova senha"
                required
              />
              <button type="button" onClick={() => setMostrarNovaSenha((v) => !v)}>
                {mostrarNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {erros.novaSenha && <span className="usuario-form-campo-erro">{erros.novaSenha}</span>}
          </div>

          <div className={`usuario-form-campo ${erros.confirmarNovaSenha ? "campo-invalido" : ""}`}>
            <label htmlFor="us-confirmar-nova-senha">
              Confirmar nova senha <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-senha-wrapper">
              <input
                id="us-confirmar-nova-senha"
                type={mostrarNovaSenha ? "text" : "password"}
                value={confirmarNovaSenha}
                onChange={(e) => {
                  setConfirmarNovaSenha(e.target.value);
                  if (erros.confirmarNovaSenha) setErros((atual) => ({ ...atual, confirmarNovaSenha: "" }));
                }}
                placeholder="Repita a nova senha"
                required
              />
              <button type="button" onClick={() => setMostrarNovaSenha((v) => !v)}>
                {mostrarNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {erros.confirmarNovaSenha && <span className="usuario-form-campo-erro">{erros.confirmarNovaSenha}</span>}
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : "Alterar Senha"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default UsuarioSenha;
