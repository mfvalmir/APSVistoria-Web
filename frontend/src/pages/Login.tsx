import { useState } from "react";
import { isAxiosError } from "axios";
import { login } from "../api/auth";
import "./Login.css";

interface LoginProps {
  onLoginSuccess: () => void;
}

function Login({ onLoginSuccess }: LoginProps) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  function limparFormulario() {
    setUsuario("");
    setSenha("");
    setErro("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const token = await login(usuario, senha);
      localStorage.setItem("token", token);
      onLoginSuccess();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Usuário ou senha inválidos");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <h1>Bem Vindo ao</h1>
        <p>
          Sistema de Controle de Loja para
          <br />
          Vistoria Automotiva
        </p>

        <div className="login-logo-box">
          <img src="/images/logo-aps-vistoria.png" alt="APS Vistoria" />
        </div>

        <div className="login-version">Versão: 1.0.0</div>

        <div className="login-footer">
          DESENVOLVIDO POR: VALMIR FCO. MAGALHÃES
          <br />
          <a href="mailto:mfvalmir@hotmail.com.br">mfvalmir@hotmail.com.br</a>
        </div>
      </div>

      <div className="login-form-side">
        <form className="login-form-box" onSubmit={handleSubmit}>
          <h2>Acessar sua conta.</h2>
          <p>Informe seus dados de acesso.</p>

          <div className="login-field">
            <label htmlFor="login-usuario">Login</label>
            <input
              id="login-usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-senha">Senha</label>
            <input
              id="login-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          {erro && <div className="login-error">{erro}</div>}

          <div className="login-actions">
            <button type="submit" className="login-btn" disabled={carregando}>
              {carregando ? "Acessando..." : "Acessar"}
            </button>
            <button
              type="button"
              className="login-btn secondary"
              onClick={limparFormulario}
              disabled={carregando}
            >
              Cancelar
            </button>
          </div>

          <div className="login-note">Software liberado para APS Vistoria.</div>
        </form>
      </div>
    </div>
  );
}

export default Login;
