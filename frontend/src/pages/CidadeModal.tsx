import { useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarCidade, Cidade } from "../api/cidades";
import "./UsuarioForm.css";
import "./CidadeModal.css";

interface CidadeModalProps {
  onCancelar: () => void;
  onCriada: (cidade: Cidade) => void;
}

function CidadeModal({ onCancelar, onCriada }: CidadeModalProps) {
  const [descricaoCidade, setDescricaoCidade] = useState("");
  const [uf, setUf] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar() {
    if (salvando) return;
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!descricaoCidade.trim()) novosErros.descricaoCidade = "Informe a descrição";
    if (!uf.trim()) novosErros.uf = "Informe a UF";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      const { idCidade } = await criarCidade({ descricaoCidade: descricaoCidade.trim(), uf });
      onCriada({ idCidade, DescricaoCidade: descricaoCidade.trim(), UF: uf });
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar a cidade");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Nova Cidade" onFechar={onCancelar}>
      <form
        className="usuario-form cidade-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.descricaoCidade ? "campo-invalido" : ""}`}>
            <label htmlFor="cm-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="cm-descricao"
              value={descricaoCidade}
              onChange={(e) => {
                setDescricaoCidade(e.target.value);
                if (erros.descricaoCidade) setErros((atual) => ({ ...atual, descricaoCidade: "" }));
              }}
              placeholder="Digite o nome da cidade"
              maxLength={50}
              autoFocus
              required
            />
            {erros.descricaoCidade && <span className="usuario-form-campo-erro">{erros.descricaoCidade}</span>}
          </div>

          <div className={`usuario-form-campo usuario-form-campo-status ${erros.uf ? "campo-invalido" : ""}`}>
            <label htmlFor="cm-uf">
              UF <span className="obrigatorio">*</span>
            </label>
            <input
              id="cm-uf"
              value={uf}
              onChange={(e) => {
                setUf(e.target.value.toUpperCase());
                if (erros.uf) setErros((atual) => ({ ...atual, uf: "" }));
              }}
              placeholder="UF"
              maxLength={2}
              required
            />
            {erros.uf && <span className="usuario-form-campo-erro">{erros.uf}</span>}
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="cidade-modal-acoes">
          <button type="submit" className="cidade-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Cidade"}
          </button>
          <button type="button" className="cidade-modal-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default CidadeModal;
