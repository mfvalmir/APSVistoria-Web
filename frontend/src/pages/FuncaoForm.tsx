import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send } from "lucide-react";
import { obterFuncao, criarFuncao, atualizarFuncao } from "../api/funcao";
import { focarProximoCampoAoEnter } from "../utils/form";
import { useToast } from "../contexts/ToastContext";
import "./UsuarioForm.css";

interface FuncaoFormProps {
  id: number | null;
  onVoltar: () => void;
}

function FuncaoForm({ id, onVoltar }: FuncaoFormProps) {
  const modoEdicao = id !== null;

  const [descricao, setDescricao] = useState("");

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterFuncao(id)
      .then((f) => setDescricao(f.descricao))
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!descricao.trim()) novosErros.descricao = "Informe a descrição";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = { descricao };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarFuncao(id, dados);
        mostrarToast("Função atualizada com sucesso", "sucesso");
      } else {
        await criarFuncao(dados);
        mostrarToast("Função criada com sucesso", "sucesso");
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar a função");
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
        <h2>{modoEdicao ? "Editar Função" : "Nova Função"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.descricao ? "campo-invalido" : ""}`}>
            <label htmlFor="ff-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="ff-descricao"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                if (erros.descricao) setErros((atual) => ({ ...atual, descricao: "" }));
              }}
              placeholder="Digite a descrição da função"
              maxLength={50}
              required
            />
            {erros.descricao && <span className="usuario-form-campo-erro">{erros.descricao}</span>}
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Função"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default FuncaoForm;
