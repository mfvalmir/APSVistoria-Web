import { useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarResponsavel, Responsavel } from "../api/responsaveis";
import { validarCPF } from "../utils/documento";
import "./UsuarioForm.css";
import "./ResponsavelModal.css";

interface ResponsavelModalProps {
  idCliente: number;
  onCancelar: () => void;
  onCriado: (responsavel: Responsavel) => void;
}

function formatarCPF(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

// Modal enxuto - reaproveitado a partir do campo Responsável em Lançar Vistoria. O cadastro
// completo de responsáveis (edição, exclusão) continua só no Cadastro de Clientes.
function ResponsavelModal({ idCliente, onCancelar, onCriado }: ResponsavelModalProps) {
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [docResponsavel, setDocResponsavel] = useState("");
  const [celularResponsavel, setCelularResponsavel] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar() {
    if (salvando) return;
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!nomeResponsavel.trim()) novosErros.nomeResponsavel = "Informe o nome do responsável";
    if (docResponsavel && !validarCPF(docResponsavel)) novosErros.docResponsavel = "CPF inválido";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      const docDigitos = docResponsavel.replace(/\D/g, "");
      const { idResponsavel } = await criarResponsavel(idCliente, {
        nomeResponsavel: nomeResponsavel.trim(),
        docResponsavel: docDigitos || undefined,
        celularResponsavel: celularResponsavel || undefined,
      });
      onCriado({
        idResponsavel,
        idCliente,
        NomeResponsavel: nomeResponsavel.trim(),
        DocResponsavel: docDigitos || null,
        CelularResponsavel: celularResponsavel || null,
      });
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o responsável");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Novo Responsável" onFechar={onCancelar}>
      <form
        className="usuario-form responsavel-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.nomeResponsavel ? "campo-invalido" : ""}`}>
            <label htmlFor="rsm-nome">
              Nome <span className="obrigatorio">*</span>
            </label>
            <input
              id="rsm-nome"
              value={nomeResponsavel}
              onChange={(e) => {
                setNomeResponsavel(e.target.value);
                if (erros.nomeResponsavel) setErros((atual) => ({ ...atual, nomeResponsavel: "" }));
              }}
              placeholder="Digite o nome do responsável"
              maxLength={50}
              autoFocus
              required
            />
            {erros.nomeResponsavel && <span className="usuario-form-campo-erro">{erros.nomeResponsavel}</span>}
          </div>

          <div
            className={`usuario-form-campo responsavel-modal-campo-doc ${
              erros.docResponsavel ? "campo-invalido" : ""
            }`}
          >
            <label htmlFor="rsm-doc">CPF</label>
            <input
              id="rsm-doc"
              value={docResponsavel}
              onChange={(e) => {
                setDocResponsavel(formatarCPF(e.target.value));
                if (erros.docResponsavel) setErros((atual) => ({ ...atual, docResponsavel: "" }));
              }}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={14}
            />
            {erros.docResponsavel && <span className="usuario-form-campo-erro">{erros.docResponsavel}</span>}
          </div>

          <div className="usuario-form-campo responsavel-modal-campo-celular">
            <label htmlFor="rsm-celular">Celular</label>
            <input
              id="rsm-celular"
              value={celularResponsavel}
              onChange={(e) => setCelularResponsavel(e.target.value)}
              placeholder="(00) 00000-0000"
              maxLength={20}
            />
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="responsavel-modal-acoes">
          <button type="submit" className="responsavel-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Responsável"}
          </button>
          <button type="button" className="responsavel-modal-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ResponsavelModal;
