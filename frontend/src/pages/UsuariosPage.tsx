import { useEffect, useState } from "react";
import { listarUsuarios, criarUsuario, Usuario } from "../api/usuarios";

function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [idFuncionario, setIdFuncionario] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [administrador, setAdministrador] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const dados = await listarUsuarios();
    setUsuarios(dados);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await criarUsuario({
      idFuncionario: Number(idFuncionario),
      login,
      senha,
      administrador,
    });
    setIdFuncionario("");
    setLogin("");
    setSenha("");
    setAdministrador(false);
    carregar();
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2>Usuários</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          placeholder="ID do Funcionário"
          type="number"
          value={idFuncionario}
          onChange={(e) => setIdFuncionario(e.target.value)}
          style={{ width: 140 }}
          required
        />
        <input
          placeholder="Login"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
        />
        <input
          placeholder="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={administrador}
            onChange={(e) => setAdministrador(e.target.checked)}
          />
          Administrador
        </label>
        <button type="submit">Adicionar</button>
      </form>

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Login</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Funcionário</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Situação</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Admin</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.IDUser}>
                <td>{u.Loginn}</td>
                <td>{u.NomeFuncionario}</td>
                <td>{u.Situacao.trim()}</td>
                <td>{u.Administrador.trim() === "S" ? "Sim" : "Não"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default UsuariosPage;
