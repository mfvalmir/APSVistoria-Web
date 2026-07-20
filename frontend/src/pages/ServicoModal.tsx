import { useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarServico, Servico } from "../api/servico";
import "./UsuarioForm.css";
import "./ServicoModal.css";

interface ServicoModalProps {
  onCancelar: () => void;
  onCriado: (servico: Servico) => void;
}

function formatarMoeda(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return "";
  const numero = (Number(digitos) / 100).toFixed(2);
  const [inteiro, centavos] = numero.split(".");
  const inteiroFormatado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${inteiroFormatado},${centavos}`;
}

function moedaParaNumero(valor: string): number | null {
  const limpo = valor.replace(/[^\d,]/g, "").replace(",", ".");
  return limpo ? Number(limpo) : null;
}

function ServicoModal({ onCancelar, onCriado }: ServicoModalProps) {
  const [descricaoServico, setDescricaoServico] = useState("");
  const [valorServico, setValorServico] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar() {
    if (salvando) return;
    setErro("");

    const valorNumero = moedaParaNumero(valorServico);
    const novosErros: Record<string, string> = {};
    if (!descricaoServico.trim()) novosErros.descricaoServico = "Informe a descrição";
    if (valorNumero === null) novosErros.valorServico = "Informe o valor do serviço";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || valorNumero === null) return;

    setSalvando(true);
    try {
      const { idServico } = await criarServico({
        descricaoServico: descricaoServico.trim(),
        valorServico: valorNumero,
      });
      onCriado({ idServico, DescricaoServico: descricaoServico.trim(), ValorServico: valorNumero, Situacao: "A" });
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o serviço");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Novo Serviço" onFechar={onCancelar}>
      <form
        className="usuario-form servico-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.descricaoServico ? "campo-invalido" : ""}`}>
            <label htmlFor="svm-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="svm-descricao"
              value={descricaoServico}
              onChange={(e) => {
                setDescricaoServico(e.target.value);
                if (erros.descricaoServico) setErros((atual) => ({ ...atual, descricaoServico: "" }));
              }}
              placeholder="Digite a descrição do serviço"
              maxLength={100}
              autoFocus
              required
            />
            {erros.descricaoServico && <span className="usuario-form-campo-erro">{erros.descricaoServico}</span>}
          </div>

          <div className={`usuario-form-campo servico-modal-campo-valor ${erros.valorServico ? "campo-invalido" : ""}`}>
            <label htmlFor="svm-valor">
              Valor <span className="obrigatorio">*</span>
            </label>
            <input
              id="svm-valor"
              value={valorServico}
              onChange={(e) => {
                setValorServico(formatarMoeda(e.target.value));
                if (erros.valorServico) setErros((atual) => ({ ...atual, valorServico: "" }));
              }}
              placeholder="R$ 0,00"
              inputMode="numeric"
              required
            />
            {erros.valorServico && <span className="usuario-form-campo-erro">{erros.valorServico}</span>}
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="servico-modal-acoes">
          <button type="submit" className="servico-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Serviço"}
          </button>
          <button type="button" className="servico-modal-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ServicoModal;
