import { useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarCategoria, Categoria } from "../api/categoria";
import "./UsuarioForm.css";
import "./CategoriaModal.css";

interface CategoriaModalProps {
  onCancelar: () => void;
  onCriada: (categoria: Categoria) => void;
}

function CategoriaModal({ onCancelar, onCriada }: CategoriaModalProps) {
  const [descricaoCategoria, setDescricaoCategoria] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar() {
    if (salvando) return;
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!descricaoCategoria.trim()) novosErros.descricaoCategoria = "Informe a descrição";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      const { IdCategoria } = await criarCategoria({ descricaoCategoria: descricaoCategoria.trim() });
      onCriada({ IdCategoria, DescricaoCategoria: descricaoCategoria.trim() });
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

  return (
    <Modal titulo="Nova Categoria" onFechar={onCancelar}>
      <form
        className="usuario-form categoria-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className={`usuario-form-campo ${erros.descricaoCategoria ? "campo-invalido" : ""}`}>
          <label htmlFor="cam-descricao">
            Descrição <span className="obrigatorio">*</span>
          </label>
          <input
            id="cam-descricao"
            value={descricaoCategoria}
            onChange={(e) => {
              setDescricaoCategoria(e.target.value);
              if (erros.descricaoCategoria) setErros((atual) => ({ ...atual, descricaoCategoria: "" }));
            }}
            placeholder="Digite a descrição da categoria"
            maxLength={100}
            autoFocus
            required
          />
          {erros.descricaoCategoria && <span className="usuario-form-campo-erro">{erros.descricaoCategoria}</span>}
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="categoria-modal-acoes">
          <button type="submit" className="categoria-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Categoria"}
          </button>
          <button type="button" className="categoria-modal-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default CategoriaModal;
