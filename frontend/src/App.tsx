import { useEffect, useState } from "react";
import { listarUsuarios, criarUsuario, Usuario } from "./api/usuarios";

function App() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
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
    await criarUsuario(nome, usuario);
    setNome("");
    setUsuario("");
    carregar();
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Usuários</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <input
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          placeholder="Usuário"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button type="submit">Adicionar</button>
      </form>

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <ul>
          {usuarios.map((u) => (
            <li key={u.id}>
              {u.nome} ({u.usuario})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
