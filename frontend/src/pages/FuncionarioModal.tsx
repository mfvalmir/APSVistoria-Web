import { useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarFuncionario, FuncionarioResumo } from "../api/funcionarios";
import "./UsuarioForm.css";
import "./FuncionarioModal.css";

interface FuncionarioModalProps {
  onCancelar: () => void;
  onCriado: (funcionario: FuncionarioResumo) => void;
}

// Modal enxuto - reaproveitado a partir do campo Vistoriador em Lançar Vistoria, por isso já
// nasce com "Faz Vistoria" marcado. Os demais dados do funcionário (CPF, endereço, banco etc.)
// ficam para o Cadastro de Funcionários completo, se precisar detalhar depois.
function FuncionarioModal({ onCancelar, onCriado }: FuncionarioModalProps) {
  const [nomeFuncionario, setNomeFuncionario] = useState("");
  const [fazVistoria, setFazVistoria] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar() {
    if (salvando) return;
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!nomeFuncionario.trim()) novosErros.nomeFuncionario = "Informe o nome do funcionário";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      const { idFuncionario } = await criarFuncionario({
        nomeFuncionario: nomeFuncionario.trim(),
        fazVistoria,
      });
      onCriado({ IdFuncionario: idFuncionario, NomeFuncionario: nomeFuncionario.trim() });
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o funcionário");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Novo Funcionário" onFechar={onCancelar}>
      <form
        className="usuario-form funcionario-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.nomeFuncionario ? "campo-invalido" : ""}`}>
            <label htmlFor="fnm-nome">
              Nome <span className="obrigatorio">*</span>
            </label>
            <input
              id="fnm-nome"
              value={nomeFuncionario}
              onChange={(e) => {
                setNomeFuncionario(e.target.value);
                if (erros.nomeFuncionario) setErros((atual) => ({ ...atual, nomeFuncionario: "" }));
              }}
              placeholder="Digite o nome do funcionário"
              autoFocus
              required
            />
            {erros.nomeFuncionario && <span className="usuario-form-campo-erro">{erros.nomeFuncionario}</span>}
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="fnm-vistoria">Faz Vistoria</label>
            <select
              id="fnm-vistoria"
              value={fazVistoria ? "S" : "N"}
              onChange={(e) => setFazVistoria(e.target.value === "S")}
            >
              <option value="S">Sim</option>
              <option value="N">Não</option>
            </select>
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="funcionario-modal-acoes">
          <button type="submit" className="funcionario-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Funcionário"}
          </button>
          <button type="button" className="funcionario-modal-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default FuncionarioModal;
