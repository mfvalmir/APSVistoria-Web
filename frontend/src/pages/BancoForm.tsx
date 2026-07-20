import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send } from "lucide-react";
import { obterBanco, criarBanco, atualizarBanco } from "../api/banco";
import { focarProximoCampoAoEnter } from "../utils/form";
import { useToast } from "../contexts/ToastContext";
import "./UsuarioForm.css";

interface BancoFormProps {
  id: number | null;
  onVoltar: () => void;
}

function BancoForm({ id, onVoltar }: BancoFormProps) {
  const modoEdicao = id !== null;

  const [descricaoBanco, setDescricaoBanco] = useState("");

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterBanco(id)
      .then((b) => setDescricaoBanco(b.DescricaoBanco))
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!descricaoBanco.trim()) novosErros.descricaoBanco = "Informe a descrição";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = { descricaoBanco };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarBanco(id, dados);
        mostrarToast("Banco atualizado com sucesso", "sucesso");
      } else {
        await criarBanco(dados);
        mostrarToast("Banco criado com sucesso", "sucesso");
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o banco");
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
        <h2>{modoEdicao ? "Editar Banco" : "Novo Banco"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.descricaoBanco ? "campo-invalido" : ""}`}>
            <label htmlFor="bf-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="bf-descricao"
              value={descricaoBanco}
              onChange={(e) => {
                setDescricaoBanco(e.target.value);
                if (erros.descricaoBanco) setErros((atual) => ({ ...atual, descricaoBanco: "" }));
              }}
              placeholder="Digite a descrição do banco"
              maxLength={50}
              required
            />
            {erros.descricaoBanco && <span className="usuario-form-campo-erro">{erros.descricaoBanco}</span>}
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Banco"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default BancoForm;
