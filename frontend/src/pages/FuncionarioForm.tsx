import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, ExternalLink, Send } from "lucide-react";
import {
  obterFuncionario,
  criarFuncionario,
  atualizarFuncionario,
  buscarFuncoes,
  buscarBancos,
  buscarBairros,
  FuncaoOpcao,
  BancoOpcao,
  BairroOpcao,
} from "../api/funcionarios";
import { focarProximoCampoAoEnter } from "../utils/form";
import { validarCPF } from "../utils/documento";
import "./UsuarioForm.css";
import "./FuncionarioForm.css";

interface FuncionarioFormProps {
  id: number | null;
  onVoltar: () => void;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
}

function paraInputDate(valor: string | null): string {
  if (!valor) return "";
  return valor.slice(0, 10);
}

function formatarCPF(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

function formatarCEP(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d;
}

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

function moedaParaNumero(valor: string): number | null {
  const limpo = valor.replace(/[^\d,]/g, "").replace(",", ".");
  return limpo ? Number(limpo) : null;
}

function FuncionarioForm({ id, onVoltar, navegarPara }: FuncionarioFormProps) {
  const modoEdicao = id !== null;

  const [nomeFuncionario, setNomeFuncionario] = useState("");
  const [situacao, setSituacao] = useState<"A" | "I">("A");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [idFuncao, setIdFuncao] = useState<number | null>(null);
  const [salario, setSalario] = useState("");
  const [telCelular, setTelCelular] = useState("");
  const [telResidencial, setTelResidencial] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cep, setCep] = useState("");
  const [idBairro, setIdBairro] = useState<number | null>(null);
  const [nomeBairro, setNomeBairro] = useState("");
  const [idBanco, setIdBanco] = useState<number | null>(null);
  const [agencia, setAgencia] = useState("");
  const [numContaBanco, setNumContaBanco] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [fazVistoria, setFazVistoria] = useState(false);
  const [observacao, setObservacao] = useState("");

  const [funcoes, setFuncoes] = useState<FuncaoOpcao[]>([]);
  const [bancos, setBancos] = useState<BancoOpcao[]>([]);
  const [sugestoesBairro, setSugestoesBairro] = useState<BairroOpcao[]>([]);
  const [mostrarSugestoesBairro, setMostrarSugestoesBairro] = useState(false);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    buscarFuncoes().then(setFuncoes);
    buscarBancos().then(setBancos);
  }, []);

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterFuncionario(id)
      .then((f) => {
        setNomeFuncionario(f.NomeFuncionario);
        setSituacao(f.Situacao.trim() === "I" ? "I" : "A");
        setCpf(formatarCPF(f.CPF || ""));
        setDataNascimento(f.DataNascimento || "");
        setDataAdmissao(paraInputDate(f.DataAdmissao));
        setIdFuncao(f.idFuncao);
        setSalario(f.Salario != null ? numeroParaMoeda(f.Salario) : "");
        setTelCelular(f.TelCelular || "");
        setTelResidencial(f.TelResidencial || "");
        setEndereco(f.Endereco || "");
        setCep(formatarCEP(f.CEP || ""));
        setIdBairro(f.idBairro);
        setNomeBairro(f.DescricaoBairro || "");
        setIdBanco(f.IDBanco);
        setAgencia(f.Agencia || "");
        setNumContaBanco(f.NumContaBanco || "");
        setChavePix(f.ChavePix || "");
        setFazVistoria(f.FazVistoria);
        setObservacao(f.Observacao || "");
      })
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  useEffect(() => {
    if (nomeBairro.trim().length < 2) {
      setSugestoesBairro([]);
      return;
    }
    const timeout = setTimeout(() => {
      buscarBairros(nomeBairro).then(setSugestoesBairro);
    }, 250);
    return () => clearTimeout(timeout);
  }, [nomeBairro]);

  function selecionarBairro(b: BairroOpcao) {
    setIdBairro(b.IDBairro);
    setNomeBairro(b.DescricaoCidade ? `${b.DescricaoBairro} - ${b.DescricaoCidade}/${b.UF}` : b.DescricaoBairro);
    setSugestoesBairro([]);
    setMostrarSugestoesBairro(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!nomeFuncionario) {
      setErro("Informe o nome do funcionário");
      return;
    }
    if (cpf && !validarCPF(cpf)) {
      setErro("CPF inválido");
      return;
    }

    const dados = {
      nomeFuncionario,
      endereco: endereco || undefined,
      cep: cep || undefined,
      idBairro,
      telCelular: telCelular || undefined,
      telResidencial: telResidencial || undefined,
      idFuncao,
      fazVistoria,
      dataAdmissao: dataAdmissao || undefined,
      salario: moedaParaNumero(salario),
      idBanco,
      agencia: agencia || undefined,
      numContaBanco: numContaBanco || undefined,
      cpf: cpf || undefined,
      chavePix: chavePix || undefined,
      dataNascimento: dataNascimento || undefined,
      observacao: observacao || undefined,
    };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarFuncionario(id, { ...dados, situacao });
      } else {
        await criarFuncionario(dados);
      }
      onVoltar();
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

  if (carregando) {
    return <div className="usuario-form-pagina">Carregando...</div>;
  }

  return (
    <div className="usuario-form-pagina">
      <div className="usuario-form-cabecalho">
        <button className="usuario-form-voltar" onClick={onVoltar} type="button">
          <ArrowLeft size={18} />
        </button>
        <h2>{modoEdicao ? "Editar Funcionário" : "Novo Funcionário"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form">
        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="ff-nome">
              Nome <span className="obrigatorio">*</span>
            </label>
            <input
              id="ff-nome"
              value={nomeFuncionario}
              onChange={(e) => setNomeFuncionario(e.target.value)}
              placeholder="Digite o nome do funcionário"
              required
            />
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="ff-vistoria">Faz Vistoria</label>
            <select
              id="ff-vistoria"
              value={fazVistoria ? "S" : "N"}
              onChange={(e) => setFazVistoria(e.target.value === "S")}
            >
              <option value="S">Sim</option>
              <option value="N">Não</option>
            </select>
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="ff-situacao">
              Status <span className="obrigatorio">*</span>
            </label>
            <select id="ff-situacao" value={situacao} onChange={(e) => setSituacao(e.target.value as "A" | "I")}>
              <option value="A">Ativo</option>
              <option value="I">Inativo</option>
            </select>
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="ff-cpf">CPF</label>
            <input
              id="ff-cpf"
              value={cpf}
              onChange={(e) => setCpf(formatarCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={14}
            />
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="ff-nascimento">Data de Nascimento</label>
            <input
              id="ff-nascimento"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              placeholder="dd/mm/aaaa"
              maxLength={10}
            />
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="ff-admissao">Data de Admissão</label>
            <input
              id="ff-admissao"
              type="date"
              value={dataAdmissao}
              onChange={(e) => setDataAdmissao(e.target.value)}
            />
          </div>

          <div className="usuario-form-campo funcionario-form-campo-larga">
            <label htmlFor="ff-funcao">Função</label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="ff-funcao"
                value={idFuncao ?? ""}
                onChange={(e) => setIdFuncao(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione...</option>
                {funcoes.map((f) => (
                  <option key={f.idFuncao} value={f.idFuncao}>
                    {f.descricao}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Ir para Cadastro de Funções"
                onClick={() => navegarPara?.("funcao", "Cadastro de Funções", "Cadastros")}
              >
                <ExternalLink size={16} />
              </button>
            </div>
          </div>

          <div className="usuario-form-campo funcionario-form-campo-salario">
            <label htmlFor="ff-salario">Salário</label>
            <input
              id="ff-salario"
              value={salario}
              onChange={(e) => setSalario(formatarMoeda(e.target.value))}
              placeholder="R$ 0,00"
              inputMode="numeric"
            />
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="ff-celular">Telefone Celular</label>
            <input id="ff-celular" value={telCelular} onChange={(e) => setTelCelular(e.target.value)} maxLength={14} />
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="ff-residencial">Telefone Residencial</label>
            <input
              id="ff-residencial"
              value={telResidencial}
              onChange={(e) => setTelResidencial(e.target.value)}
              maxLength={14}
            />
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="ff-endereco">Endereço</label>
            <input id="ff-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} maxLength={100} />
          </div>

          <div className="usuario-form-campo usuario-form-combobox">
            <label htmlFor="ff-bairro">Bairro</label>
            <div className="usuario-form-campo-com-acao">
              <input
                id="ff-bairro"
                value={nomeBairro}
                onChange={(e) => {
                  setNomeBairro(e.target.value);
                  setIdBairro(null);
                  setMostrarSugestoesBairro(true);
                }}
                onFocus={() => setMostrarSugestoesBairro(true)}
                onBlur={() => setTimeout(() => setMostrarSugestoesBairro(false), 150)}
                placeholder="Digite o bairro para buscar..."
                autoComplete="off"
              />
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Ir para Cadastro de Bairros"
                onClick={() => navegarPara?.("bairros", "Cadastro de Bairros", "Cadastros")}
              >
                <ExternalLink size={16} />
              </button>
            </div>
            {mostrarSugestoesBairro && sugestoesBairro.length > 0 && (
              <ul className="usuario-form-sugestoes">
                {sugestoesBairro.map((b) => (
                  <li key={b.IDBairro} onMouseDown={() => selecionarBairro(b)}>
                    {b.DescricaoBairro}
                    {b.DescricaoCidade ? ` - ${b.DescricaoCidade}/${b.UF}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="ff-cep">CEP</label>
            <input
              id="ff-cep"
              value={cep}
              onChange={(e) => setCep(formatarCEP(e.target.value))}
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
            />
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="ff-banco">Banco</label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="ff-banco"
                value={idBanco ?? ""}
                onChange={(e) => setIdBanco(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione...</option>
                {bancos.map((b) => (
                  <option key={b.idBanco} value={b.idBanco}>
                    {b.DescricaoBanco}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Ir para Cadastro de Bancos"
                onClick={() => navegarPara?.("banco", "Cadastro de Bancos", "Cadastros")}
              >
                <ExternalLink size={16} />
              </button>
            </div>
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="ff-agencia">Agência</label>
            <input id="ff-agencia" value={agencia} onChange={(e) => setAgencia(e.target.value)} maxLength={10} />
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="ff-conta">Conta</label>
            <input
              id="ff-conta"
              value={numContaBanco}
              onChange={(e) => setNumContaBanco(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="ff-pix">Chave Pix</label>
            <input id="ff-pix" value={chavePix} onChange={(e) => setChavePix(e.target.value)} maxLength={50} />
          </div>
        </div>

        <div className="usuario-form-campo">
          <label htmlFor="ff-observacao">Observação</label>
          <textarea
            id="ff-observacao"
            className="funcionario-form-textarea"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={4}
          />
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Funcionário"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default FuncionarioForm;
