import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { baixarParcela, ParcelaContaReceber } from "../api/contaReceber";
import { listarTiposPagamentoPadrao, TipoPagamento } from "../api/tipoPagamento";
import { decodeToken } from "../utils/jwt";
import "./UsuarioForm.css";
import "./ContaReceberBaixaModal.css";

interface UsuarioLogado {
  id: number;
  nome: string;
  login: string;
}

function usuarioLogado(): UsuarioLogado | null {
  const token = sessionStorage.getItem("token");
  if (!token) return null;
  return decodeToken<UsuarioLogado>(token);
}

function pad6(valor: number): string {
  return String(valor).padStart(6, "0");
}

function formatarMoedaExibicao(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ContaReceberBaixaModalProps {
  idContaReceber: number;
  parcela: ParcelaContaReceber;
  onCancelar: () => void;
  onBaixada: () => void;
}

function ContaReceberBaixaModal({ idContaReceber, parcela, onCancelar, onBaixada }: ContaReceberBaixaModalProps) {
  const usuario = usuarioLogado();

  const [dataPagamento, setDataPagamento] = useState(hoje());
  const [desconto, setDesconto] = useState("0");
  const [juros, setJuros] = useState("0");
  const [multa, setMulta] = useState("0");
  const [idTipoPagamento, setIdTipoPagamento] = useState<number | null>(null);
  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([]);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    listarTiposPagamentoPadrao().then(setTiposPagamento);
  }, []);

  const valorPago = parcela.ValorParcela - (Number(desconto) || 0) + (Number(juros) || 0) + (Number(multa) || 0);

  async function salvar() {
    if (salvando) return;
    setErro("");

    if (!dataPagamento) {
      setErro("Informe a data de pagamento");
      return;
    }
    if (!idTipoPagamento) {
      setErro("Informe o tipo de pagamento");
      return;
    }

    setSalvando(true);
    try {
      await baixarParcela(idContaReceber, parcela.IdContaReceberParcela, {
        dataPagamento,
        valorDesconto: Number(desconto) || 0,
        valorJuros: Number(juros) || 0,
        valorMulta: Number(multa) || 0,
        idTipoPagamento: idTipoPagamento ?? undefined,
      });
      onBaixada();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível baixar a parcela");
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
  }, [dataPagamento, desconto, juros, multa, idTipoPagamento, salvando]);

  return (
    <Modal titulo="Baixar Parcela Contas a Receber" onFechar={onCancelar}>
      <form
        className="usuario-form conta-receber-baixa-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <div className="usuario-form-linha">
          <div className="usuario-form-campo conta-receber-baixa-campo-pequeno">
            <label>Código</label>
            <input value={pad6(idContaReceber)} disabled readOnly />
          </div>
          <div className="usuario-form-campo conta-receber-baixa-campo-pequeno">
            <label>Parcela Nº</label>
            <input value={pad6(parcela.NumeroParcela)} disabled readOnly />
          </div>
          <div className="usuario-form-campo conta-receber-baixa-campo-medio">
            <label>Valor</label>
            <input value={formatarMoedaExibicao(parcela.ValorParcela)} disabled readOnly />
          </div>
          <div className="usuario-form-campo conta-receber-baixa-campo-medio">
            <label htmlFor="br-data-pagamento">
              Data Pagamento <span className="obrigatorio">*</span>
            </label>
            <input
              id="br-data-pagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="usuario-form-campo conta-receber-baixa-campo-medio">
            <label>Status</label>
            <span className="conta-receber-badge pendente conta-receber-baixa-badge">PENDENTE</span>
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo conta-receber-baixa-campo-pequeno">
            <label htmlFor="br-desconto">Desconto</label>
            <input
              id="br-desconto"
              type="number"
              min={0}
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
            />
          </div>
          <div className="usuario-form-campo conta-receber-baixa-campo-pequeno">
            <label htmlFor="br-juros">Juros</label>
            <input
              id="br-juros"
              type="number"
              min={0}
              step="0.01"
              value={juros}
              onChange={(e) => setJuros(e.target.value)}
            />
          </div>
          <div className="usuario-form-campo conta-receber-baixa-campo-pequeno">
            <label htmlFor="br-multa">Multa</label>
            <input
              id="br-multa"
              type="number"
              min={0}
              step="0.01"
              value={multa}
              onChange={(e) => setMulta(e.target.value)}
            />
          </div>
          <div className="usuario-form-campo conta-receber-baixa-campo-medio">
            <label>
              Valor Pago <span className="obrigatorio">*</span>
            </label>
            <input value={formatarMoedaExibicao(valorPago)} disabled readOnly />
          </div>
          <div className="usuario-form-campo conta-receber-baixa-campo-tipo-pagamento">
            <label htmlFor="br-tipo-pagamento">
              Tipo de Pagamento <span className="obrigatorio">*</span>
            </label>
            <select
              id="br-tipo-pagamento"
              value={idTipoPagamento ?? ""}
              onChange={(e) => setIdTipoPagamento(e.target.value ? Number(e.target.value) : null)}
              required
            >
              <option value="">Selecione...</option>
              {tiposPagamento.map((t) => (
                <option key={t.idTipoPagamento} value={t.idTipoPagamento}>
                  {t.DescricaoTipoPagamento}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo conta-receber-baixa-campo-usuario">
            <label>
              Usuário responsável pela Baixa <span className="obrigatorio">*</span>
            </label>
            <input
              value={usuario ? `${pad6(usuario.id)} - ${usuario.nome} - ${usuario.login}` : ""}
              disabled
              readOnly
            />
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="conta-receber-baixa-acoes">
          <button type="submit" className="conta-receber-baixa-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Salvar"}
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

export default ContaReceberBaixaModal;
