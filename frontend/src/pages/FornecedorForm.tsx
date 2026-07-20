import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send } from "lucide-react";
import { obterFornecedor, criarFornecedor, atualizarFornecedor } from "../api/fornecedores";
import { focarProximoCampoAoEnter } from "../utils/form";
import { validarCPF, validarCNPJ } from "../utils/documento";
import { useToast } from "../contexts/ToastContext";
import "./UsuarioForm.css";
import "./FornecedorForm.css";

interface FornecedorFormProps {
  id: number | null;
  onVoltar: () => void;
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

// Fornecedor não tem coluna TipoPessoa (diferente de Cliente) - o tipo de documento é
// inferido pela quantidade de dígitos digitados: até 11 vira CPF, acima disso vira CNPJ.
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

function FornecedorForm({ id, onVoltar }: FornecedorFormProps) {
  const modoEdicao = id !== null;

  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [observacao, setObservacao] = useState("");
  const [ativo, setAtivo] = useState<"A" | "I">("A");

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterFornecedor(id)
      .then((f) => {
        setRazaoSocial(f.RazaoSocial);
        setNomeFantasia(f.NomeFantasia || "");
        setCpfCnpj(f.CpfCnpj ? formatarDocumento(f.CpfCnpj) : "");
        setTelefone(f.Telefone || "");
        setEmail(f.Email || "");
        setObservacao(f.Observacao || "");
        setAtivo(f.Ativo.trim() === "I" ? "I" : "A");
      })
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!razaoSocial.trim()) novosErros.razaoSocial = "Informe a razão social";
    if (cpfCnpj && !documentoValido(cpfCnpj)) novosErros.cpfCnpj = "CPF/CNPJ inválido";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = {
      razaoSocial,
      nomeFantasia: nomeFantasia || undefined,
      cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, "") : undefined,
      telefone: telefone || undefined,
      email: email || undefined,
      observacao: observacao || undefined,
    };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarFornecedor(id, { ...dados, ativo });
        mostrarToast("Fornecedor atualizado com sucesso", "sucesso");
      } else {
        await criarFornecedor(dados);
        mostrarToast("Fornecedor criado com sucesso", "sucesso");
      }
      onVoltar();
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

  if (carregando) {
    return <div className="usuario-form-pagina">Carregando...</div>;
  }

  return (
    <div className="usuario-form-pagina">
      <div className="usuario-form-cabecalho">
        <button className="usuario-form-voltar" onClick={onVoltar} type="button">
          <ArrowLeft size={18} />
        </button>
        <h2>{modoEdicao ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.razaoSocial ? "campo-invalido" : ""}`}>
            <label htmlFor="ff-razao-social">
              Razão Social <span className="obrigatorio">*</span>
            </label>
            <input
              id="ff-razao-social"
              value={razaoSocial}
              onChange={(e) => {
                setRazaoSocial(e.target.value);
                if (erros.razaoSocial) setErros((atual) => ({ ...atual, razaoSocial: "" }));
              }}
              placeholder="Digite a razão social"
              maxLength={150}
              required
            />
            {erros.razaoSocial && <span className="usuario-form-campo-erro">{erros.razaoSocial}</span>}
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="ff-nome-fantasia">Nome Fantasia</label>
            <input
              id="ff-nome-fantasia"
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              placeholder="Digite o nome fantasia"
              maxLength={150}
            />
          </div>

          <div className={`usuario-form-campo fornecedor-form-campo-documento ${erros.cpfCnpj ? "campo-invalido" : ""}`}>
            <label htmlFor="ff-documento">CPF/CNPJ</label>
            <input
              id="ff-documento"
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

          {modoEdicao && (
            <div className="usuario-form-campo usuario-form-campo-status">
              <label htmlFor="ff-ativo">
                Status <span className="obrigatorio">*</span>
              </label>
              <select id="ff-ativo" value={ativo} onChange={(e) => setAtivo(e.target.value as "A" | "I")}>
                <option value="A">Ativo</option>
                <option value="I">Inativo</option>
              </select>
            </div>
          )}
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo fornecedor-form-campo-telefone">
            <label htmlFor="ff-telefone">Telefone</label>
            <input
              id="ff-telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="ff-email">Email</label>
            <input
              id="ff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>

        <div className="usuario-form-campo">
          <label htmlFor="ff-observacao">Observação</label>
          <textarea
            id="ff-observacao"
            className="fornecedor-form-textarea"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={4}
          />
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Fornecedor"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default FornecedorForm;
