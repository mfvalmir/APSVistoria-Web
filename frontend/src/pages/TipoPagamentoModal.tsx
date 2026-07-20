import { useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarTipoPagamento, TipoPagamento } from "../api/tipoPagamento";
import "./UsuarioForm.css";
import "./TipoPagamentoModal.css";

interface TipoPagamentoModalProps {
  onCancelar: () => void;
  onCriado: (tipoPagamento: TipoPagamento) => void;
}

function TipoPagamentoModal({ onCancelar, onCriado }: TipoPagamentoModalProps) {
  const [descricaoTipoPagamento, setDescricaoTipoPagamento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar() {
    if (salvando) return;
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!descricaoTipoPagamento.trim()) novosErros.descricaoTipoPagamento = "Informe a descrição";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      const { idTipoPagamento } = await criarTipoPagamento({
        descricaoTipoPagamento: descricaoTipoPagamento.trim(),
      });
      onCriado({ idTipoPagamento, DescricaoTipoPagamento: descricaoTipoPagamento.trim() });
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o tipo de pagamento");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Novo Tipo de Pagamento" onFechar={onCancelar}>
      <form
        className="usuario-form tipo-pagamento-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className={`usuario-form-campo ${erros.descricaoTipoPagamento ? "campo-invalido" : ""}`}>
          <label htmlFor="tpm-descricao">
            Descrição <span className="obrigatorio">*</span>
          </label>
          <input
            id="tpm-descricao"
            value={descricaoTipoPagamento}
            onChange={(e) => {
              setDescricaoTipoPagamento(e.target.value);
              if (erros.descricaoTipoPagamento) setErros((atual) => ({ ...atual, descricaoTipoPagamento: "" }));
            }}
            placeholder="Digite a descrição do tipo de pagamento"
            maxLength={50}
            autoFocus
            required
          />
          {erros.descricaoTipoPagamento && (
            <span className="usuario-form-campo-erro">{erros.descricaoTipoPagamento}</span>
          )}
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="tipo-pagamento-modal-acoes">
          <button type="submit" className="tipo-pagamento-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Tipo de Pagamento"}
          </button>
          <button
            type="button"
            className="tipo-pagamento-modal-btn-cancelar"
            onClick={onCancelar}
            disabled={salvando}
          >
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default TipoPagamentoModal;
