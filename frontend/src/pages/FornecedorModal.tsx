import { useState } from "react";
import { isAxiosError } from "axios";
import { Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarFornecedor, Fornecedor } from "../api/fornecedores";
import { validarCPF, validarCNPJ } from "../utils/documento";
import "./UsuarioForm.css";
import "./FornecedorForm.css";
import "./FornecedorModal.css";

interface FornecedorModalProps {
  onCancelar: () => void;
  onCriado: (fornecedor: Fornecedor) => void;
}

function formatarCPF(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

function formatarCNPJ(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 14);
  if (d.length > 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return d;
}

// Fornecedor não tem coluna TipoPessoa - o tipo de documento é inferido pela
// quantidade de dígitos digitados: até 11 vira CPF, acima disso vira CNPJ.
function formatarDocumento(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  return digitos.length > 11 ? formatarCNPJ(valor) : formatarCPF(valor);
}

function documentoValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 11) return validarCPF(digitos);
  if (digitos.length === 14) return validarCNPJ(digitos);
  return false;
}

function FornecedorModal({ onCancelar, onCriado }: FornecedorModalProps) {
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar() {
    if (salvando) return;
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!razaoSocial.trim()) novosErros.razaoSocial = "Informe a razão social";
    if (cpfCnpj && !documentoValido(cpfCnpj)) novosErros.cpfCnpj = "CPF/CNPJ inválido";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    try {
      const dados = {
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim() || undefined,
        cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, "") : undefined,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
      };
      const { idFornecedor } = await criarFornecedor(dados);
      onCriado({
        idFornecedor,
        RazaoSocial: dados.razaoSocial,
        NomeFantasia: dados.nomeFantasia ?? null,
        CpfCnpj: dados.cpfCnpj ?? null,
        Telefone: dados.telefone ?? null,
        Email: dados.email ?? null,
        Observacao: null,
        Ativo: "A",
      });
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o fornecedor");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Novo Fornecedor" onFechar={onCancelar}>
      <form
        className="usuario-form fornecedor-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.razaoSocial ? "campo-invalido" : ""}`}>
            <label htmlFor="fm-razao-social">
              Razão Social <span className="obrigatorio">*</span>
            </label>
            <input
              id="fm-razao-social"
              value={razaoSocial}
              onChange={(e) => {
                setRazaoSocial(e.target.value);
                if (erros.razaoSocial) setErros((atual) => ({ ...atual, razaoSocial: "" }));
              }}
              placeholder="Digite a razão social"
              maxLength={150}
              autoFocus
              required
            />
            {erros.razaoSocial && <span className="usuario-form-campo-erro">{erros.razaoSocial}</span>}
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="fm-nome-fantasia">Nome Fantasia</label>
            <input
              id="fm-nome-fantasia"
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              placeholder="Digite o nome fantasia"
              maxLength={150}
            />
          </div>

          <div className={`usuario-form-campo fornecedor-form-campo-documento ${erros.cpfCnpj ? "campo-invalido" : ""}`}>
            <label htmlFor="fm-documento">CPF/CNPJ</label>
            <input
              id="fm-documento"
              value={cpfCnpj}
              onChange={(e) => {
                setCpfCnpj(formatarDocumento(e.target.value));
                if (erros.cpfCnpj) setErros((atual) => ({ ...atual, cpfCnpj: "" }));
              }}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={18}
            />
            {erros.cpfCnpj && <span className="usuario-form-campo-erro">{erros.cpfCnpj}</span>}
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo fornecedor-form-campo-telefone">
            <label htmlFor="fm-telefone">Telefone</label>
            <input
              id="fm-telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="fm-email">Email</label>
            <input
              id="fm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <div className="fornecedor-modal-acoes">
          <button type="submit" className="fornecedor-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Fornecedor"}
          </button>
          <button type="button" className="fornecedor-modal-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default FornecedorModal;
