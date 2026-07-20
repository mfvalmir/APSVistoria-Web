import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send } from "lucide-react";
import { obterServico, criarServico, atualizarServico } from "../api/servico";
import { focarProximoCampoAoEnter } from "../utils/form";
import { useToast } from "../contexts/ToastContext";
import "./UsuarioForm.css";
import "./ServicoForm.css";

interface ServicoFormProps {
  id: number | null;
  onVoltar: () => void;
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

function ServicoForm({ id, onVoltar }: ServicoFormProps) {
  const modoEdicao = id !== null;

  const [descricaoServico, setDescricaoServico] = useState("");
  const [valorServico, setValorServico] = useState("");
  const [situacao, setSituacao] = useState<"A" | "I">("A");

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterServico(id)
      .then((s) => {
        setDescricaoServico(s.DescricaoServico);
        setValorServico(s.ValorServico != null ? numeroParaMoeda(s.ValorServico) : "");
        setSituacao(s.Situacao.trim() === "I" ? "I" : "A");
      })
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const valorNumero = moedaParaNumero(valorServico);
    const novosErros: Record<string, string> = {};
    if (!descricaoServico.trim()) novosErros.descricaoServico = "Informe a descrição";
    if (valorNumero === null) novosErros.valorServico = "Informe o valor do serviço";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || valorNumero === null) return;

    const dados = { descricaoServico, valorServico: valorNumero };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarServico(id, { ...dados, situacao });
        mostrarToast("Serviço atualizado com sucesso", "sucesso");
      } else {
        await criarServico(dados);
        mostrarToast("Serviço criado com sucesso", "sucesso");
      }
      onVoltar();
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

  if (carregando) {
    return <div className="usuario-form-pagina">Carregando...</div>;
  }

  return (
    <div className="usuario-form-pagina">
      <div className="usuario-form-cabecalho">
        <button className="usuario-form-voltar" onClick={onVoltar} type="button">
          <ArrowLeft size={18} />
        </button>
        <h2>{modoEdicao ? "Editar Serviço" : "Novo Serviço"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.descricaoServico ? "campo-invalido" : ""}`}>
            <label htmlFor="sf-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="sf-descricao"
              value={descricaoServico}
              onChange={(e) => {
                setDescricaoServico(e.target.value);
                if (erros.descricaoServico) setErros((atual) => ({ ...atual, descricaoServico: "" }));
              }}
              placeholder="Digite a descrição do serviço"
              maxLength={100}
              required
            />
            {erros.descricaoServico && <span className="usuario-form-campo-erro">{erros.descricaoServico}</span>}
          </div>

          <div className={`usuario-form-campo servico-form-campo-valor ${erros.valorServico ? "campo-invalido" : ""}`}>
            <label htmlFor="sf-valor">
              Valor <span className="obrigatorio">*</span>
            </label>
            <input
              id="sf-valor"
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

          {modoEdicao && (
            <div className="usuario-form-campo usuario-form-campo-status">
              <label htmlFor="sf-situacao">
                Status <span className="obrigatorio">*</span>
              </label>
              <select id="sf-situacao" value={situacao} onChange={(e) => setSituacao(e.target.value as "A" | "I")}>
                <option value="A">Ativo</option>
                <option value="I">Inativo</option>
              </select>
            </div>
          )}
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Serviço"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default ServicoForm;
