import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { fecharCaixa } from "../api/caixa";
import "./UsuarioForm.css";
import "./CaixaForm.css";
import "./CaixaFecharModal.css";

function formatarMoeda(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return "";
  const numero = (Number(digitos) / 100).toFixed(2);
  const [inteiro, centavos] = numero.split(".");
  const inteiroFormatado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${inteiroFormatado},${centavos}`;
}

function moedaParaNumero(valor: string): number {
  const limpo = valor.replace(/[^\d,]/g, "").replace(",", ".");
  return limpo ? Number(limpo) : 0;
}

interface CaixaFecharModalProps {
  idCaixa: number;
  onCancelar: () => void;
  onFechado: () => void;
}

function CaixaFecharModal({ idCaixa, onCancelar, onFechado }: CaixaFecharModalProps) {
  const [saldoFinal, setSaldoFinal] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (salvando) return;
    setErro("");

    if (!saldoFinal) {
      setErro("Informe o saldo final para fechar o caixa");
      return;
    }

    setSalvando(true);
    try {
      await fecharCaixa(idCaixa, moedaParaNumero(saldoFinal), observacao || undefined);
      onFechado();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível fechar o caixa");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        salvar();
      } else if (e.key === "F3") {
        e.preventDefault();
        onCancelar();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saldoFinal, observacao, salvando]);

  return (
    <Modal titulo="Fechar Caixa" onFechar={onCancelar}>
      <form
        className="usuario-form caixa-fechar-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <p className="caixa-fechar-aviso">
          Confirma o fechamento deste caixa? Depois de fechado, o cabeçalho não pode mais ser editado.
        </p>

        <div className="usuario-form-campo">
          <label htmlFor="fc-saldo-final">
            Saldo Final <span className="obrigatorio">*</span>
          </label>
          <input
            id="fc-saldo-final"
            value={saldoFinal}
            onChange={(e) => setSaldoFinal(formatarMoeda(e.target.value))}
            placeholder="R$ 0,00"
            inputMode="numeric"
            autoFocus
            required
          />
        </div>

        <div className="usuario-form-campo">
          <label htmlFor="fc-observacao">Observações</label>
          <textarea
            id="fc-observacao"
            className="caixa-form-textarea"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
          />
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="caixa-fechar-acoes">
          <button type="submit" className="caixa-fechar-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Fechar Caixa"}
            <span className="caixa-fechar-atalho">[F2]</span>
          </button>
          <button type="button" className="caixa-fechar-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
            <span className="caixa-fechar-atalho">[F3]</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default CaixaFecharModal;
