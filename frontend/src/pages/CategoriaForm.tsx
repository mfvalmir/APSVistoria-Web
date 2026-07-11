import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send } from "lucide-react";
import { obterCategoria, criarCategoria, atualizarCategoria } from "../api/categoria";
import { focarProximoCampoAoEnter } from "../utils/form";
import "./UsuarioForm.css";

interface CategoriaFormProps {
  id: number | null;
  onVoltar: () => void;
}

function CategoriaForm({ id, onVoltar }: CategoriaFormProps) {
  const modoEdicao = id !== null;

  const [descricaoCategoria, setDescricaoCategoria] = useState("");

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterCategoria(id)
      .then((c) => setDescricaoCategoria(c.DescricaoCategoria))
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!descricaoCategoria) {
      setErro("Informe a descrição");
      return;
    }

    const dados = { descricaoCategoria };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarCategoria(id, dados);
      } else {
        await criarCategoria(dados);
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar a categoria");
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
        <h2>{modoEdicao ? "Editar Categoria" : "Nova Categoria"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form">
        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="cf-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="cf-descricao"
              value={descricaoCategoria}
              onChange={(e) => setDescricaoCategoria(e.target.value)}
              placeholder="Digite a descrição da categoria"
              maxLength={50}
              required
            />
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Categoria"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default CategoriaForm;
