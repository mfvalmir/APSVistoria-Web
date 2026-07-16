import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { fecharCaixa, MovimentoCaixa } from "../api/caixa";
import { decodeToken } from "../utils/jwt";
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

function numeroParaMoeda(valor: number): string {
  return formatarMoeda(String(Math.round(valor * 100)));
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function pad6(valor: number): string {
  return String(valor).padStart(6, "0");
}

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

interface CaixaFecharModalProps {
  idCaixa: number;
  saldoInicial: number;
  movimentos: MovimentoCaixa[];
  observacaoAtual: string;
  onCancelar: () => void;
  onFechado: () => void;
}

function CaixaFecharModal({
  idCaixa,
  saldoInicial,
  movimentos,
  observacaoAtual,
  onCancelar,
  onFechado,
}: CaixaFecharModalProps) {
  const usuario = usuarioLogado();

  const dataFechamento = hoje();

  // Saldo Final não é digitado - é sempre o saldo inicial + entradas - saídas de todos os
  // movimentos do caixa, arredondado a centavos (soma de floats deixa resíduo tipo
  // 589.6699999999996 em vez de 589.67).
  const saldoFinal =
    Math.round(
      (saldoInicial + movimentos.reduce((soma, m) => soma + (m.TipoMovimento === "E" ? m.Valor : -m.Valor), 0)) * 100
    ) / 100;

  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (salvando) return;
    setErro("");

    // Mesmo formato de acúmulo usado em CaixaForm.tsx: nova nota com carimbo de data/hora, em
    // linha própria, entrando no topo do que já existia. Manda undefined se não digitou nada
    // agora, pra não sobrescrever a observação existente com um texto vazio.
    const texto = observacao.trim();
    const observacaoFinal = texto
      ? `${new Date().toLocaleString("pt-BR")} - ${texto}${observacaoAtual ? `\n${observacaoAtual}` : ""}`
      : undefined;

    setSalvando(true);
    try {
      await fecharCaixa(idCaixa, dataFechamento, saldoFinal, observacaoFinal);
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
  }, [observacao, salvando]);

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

        <div className="usuario-form-linha">
          <div className="usuario-form-campo caixa-fechar-campo-data">
            <label htmlFor="fc-data-fechamento">Data de Fechamento</label>
            <input
              id="fc-data-fechamento"
              type="date"
              value={dataFechamento}
              disabled
              readOnly
            />
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="fc-saldo-final">Saldo Final (inicial + entradas - saídas)</label>
            <input id="fc-saldo-final" value={numeroParaMoeda(saldoFinal)} disabled readOnly />
          </div>
        </div>

        <div className="usuario-form-campo">
          <label>Usuário responsável pelo Fechamento</label>
          <input
            value={usuario ? `${pad6(usuario.id)} - ${usuario.nome} - ${usuario.login}` : ""}
            disabled
            readOnly
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
            autoFocus
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
