import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { estornarParcela, ParcelaContaReceber } from "../api/contaReceber";
import "./UsuarioForm.css";
import "./ContaReceberBaixaModal.css";

function pad6(valor: number): string {
  return String(valor).padStart(6, "0");
}

function formatarMoedaExibicao(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataExibicao(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

interface ContaReceberEstornoModalProps {
  idContaReceber: number;
  parcela: ParcelaContaReceber;
  onCancelar: () => void;
  onEstornada: () => void;
}

function ContaReceberEstornoModal({ idContaReceber, parcela, onCancelar, onEstornada }: ContaReceberEstornoModalProps) {
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (salvando) return;
    setErro("");

    if (!observacao.trim()) {
      setErro("Informe a observação (motivo do estorno)");
      return;
    }

    setSalvando(true);
    try {
      await estornarParcela(idContaReceber, parcela.IdContaReceberParcela, observacao.trim());
      onEstornada();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível estornar a parcela");
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
  }, [observacao, salvando]);

  return (
    <Modal titulo="Estornar Parcela Contas a Receber" onFechar={onCancelar}>
      <form
        className="usuario-form conta-receber-baixa-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <p className="conta-receber-estorno-aviso">
          Você está estornando a baixa da parcela {pad6(parcela.NumeroParcela)}, vencimento{" "}
          {formatarDataExibicao(parcela.DataVencimento)}, valor {formatarMoedaExibicao(parcela.ValorPago)}. Confirma?
        </p>

        <div className="usuario-form-campo">
          <label htmlFor="er-observacao">
            Observações <span className="obrigatorio">*</span>
          </label>
          <textarea
            id="er-observacao"
            className="conta-receber-form-textarea"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={4}
            autoFocus
            required
          />
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="conta-receber-baixa-acoes">
          <button type="submit" className="conta-receber-baixa-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "OK"}
            <span className="conta-receber-baixa-atalho">[F2]</span>
          </button>
          <button type="button" className="conta-receber-baixa-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
            <span className="conta-receber-baixa-atalho">[F3]</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ContaReceberEstornoModal;
