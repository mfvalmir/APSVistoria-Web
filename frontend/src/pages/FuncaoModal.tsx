import { useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarFuncao, Funcao } from "../api/funcao";
import "./UsuarioForm.css";
import "./FuncaoModal.css";

interface FuncaoModalProps {
  onCancelar: () => void;
  onCriada: (funcao: Funcao) => void;
}

function FuncaoModal({ onCancelar, onCriada }: FuncaoModalProps) {
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar() {
    if (salvando) return;
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!descricao.trim()) novosErros.descricao = "Informe a descrição";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      const { idFuncao } = await criarFuncao({ descricao: descricao.trim() });
      onCriada({ idFuncao, descricao: descricao.trim() });
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

  return (
    <Modal titulo="Nova Função" onFechar={onCancelar}>
      <form
        className="usuario-form funcao-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className={`usuario-form-campo ${erros.descricao ? "campo-invalido" : ""}`}>
          <label htmlFor="fm-descricao">
            Descrição <span className="obrigatorio">*</span>
          </label>
          <input
            id="fm-descricao"
            value={descricao}
            onChange={(e) => {
              setDescricao(e.target.value);
              if (erros.descricao) setErros((atual) => ({ ...atual, descricao: "" }));
            }}
            placeholder="Digite a descrição da função"
            maxLength={50}
            autoFocus
            required
          />
          {erros.descricao && <span className="usuario-form-campo-erro">{erros.descricao}</span>}
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="funcao-modal-acoes">
          <button type="submit" className="funcao-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Função"}
          </button>
          <button type="button" className="funcao-modal-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default FuncaoModal;
