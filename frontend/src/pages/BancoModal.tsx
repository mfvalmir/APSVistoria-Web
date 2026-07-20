import { useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarBanco, Banco } from "../api/banco";
import "./UsuarioForm.css";
import "./BancoModal.css";

interface BancoModalProps {
  onCancelar: () => void;
  onCriado: (banco: Banco) => void;
}

function BancoModal({ onCancelar, onCriado }: BancoModalProps) {
  const [descricaoBanco, setDescricaoBanco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar() {
    if (salvando) return;
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!descricaoBanco.trim()) novosErros.descricaoBanco = "Informe a descrição do banco";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      const { idBanco } = await criarBanco({ descricaoBanco: descricaoBanco.trim() });
      onCriado({ idBanco, DescricaoBanco: descricaoBanco.trim() });
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

  return (
    <Modal titulo="Novo Banco" onFechar={onCancelar}>
      <form
        className="usuario-form banco-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className={`usuario-form-campo ${erros.descricaoBanco ? "campo-invalido" : ""}`}>
          <label htmlFor="bm-descricao-banco">
            Descrição <span className="obrigatorio">*</span>
          </label>
          <input
            id="bm-descricao-banco"
            value={descricaoBanco}
            onChange={(e) => {
              setDescricaoBanco(e.target.value);
              if (erros.descricaoBanco) setErros((atual) => ({ ...atual, descricaoBanco: "" }));
            }}
            placeholder="Digite a descrição do banco"
            maxLength={50}
            autoFocus
            required
          />
          {erros.descricaoBanco && <span className="usuario-form-campo-erro">{erros.descricaoBanco}</span>}
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="banco-modal-acoes">
          <button type="submit" className="banco-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Banco"}
          </button>
          <button type="button" className="banco-modal-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default BancoModal;
