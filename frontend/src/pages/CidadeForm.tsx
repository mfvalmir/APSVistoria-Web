import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send } from "lucide-react";
import { obterCidade, criarCidade, atualizarCidade } from "../api/cidades";
import { focarProximoCampoAoEnter } from "../utils/form";
import "./UsuarioForm.css";

interface CidadeFormProps {
  id: number | null;
  onVoltar: () => void;
}

function CidadeForm({ id, onVoltar }: CidadeFormProps) {
  const modoEdicao = id !== null;

  const [descricaoCidade, setDescricaoCidade] = useState("");
  const [uf, setUf] = useState("");

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterCidade(id)
      .then((c) => {
        setDescricaoCidade(c.DescricaoCidade);
        setUf(c.UF);
      })
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!descricaoCidade || !uf) {
      setErro("Informe a descrição e a UF");
      return;
    }

    const dados = { descricaoCidade, uf };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarCidade(id, dados);
      } else {
        await criarCidade(dados);
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar a cidade");
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
        <h2>{modoEdicao ? "Editar Cidade" : "Nova Cidade"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form">
        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="cf-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="cf-descricao"
              value={descricaoCidade}
              onChange={(e) => setDescricaoCidade(e.target.value)}
              placeholder="Digite o nome da cidade"
              maxLength={50}
              required
            />
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="cf-uf">
              UF <span className="obrigatorio">*</span>
            </label>
            <input
              id="cf-uf"
              value={uf}
              onChange={(e) => setUf(e.target.value.toUpperCase())}
              placeholder="UF"
              maxLength={2}
              required
            />
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Cidade"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default CidadeForm;
