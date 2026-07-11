import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send } from "lucide-react";
import { obterServico, criarServico, atualizarServico } from "../api/servico";
import { focarProximoCampoAoEnter } from "../utils/form";
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

    if (!descricaoServico) {
      setErro("Informe a descrição");
      return;
    }
    const valorNumero = moedaParaNumero(valorServico);
    if (valorNumero === null) {
      setErro("Informe o valor do serviço");
      return;
    }

    const dados = { descricaoServico, valorServico: valorNumero };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarServico(id, { ...dados, situacao });
      } else {
        await criarServico(dados);
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

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form">
        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="sf-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="sf-descricao"
              value={descricaoServico}
              onChange={(e) => setDescricaoServico(e.target.value)}
              placeholder="Digite a descrição do serviço"
              maxLength={100}
              required
            />
          </div>

          <div className="usuario-form-campo servico-form-campo-valor">
            <label htmlFor="sf-valor">
              Valor <span className="obrigatorio">*</span>
            </label>
            <input
              id="sf-valor"
              value={valorServico}
              onChange={(e) => setValorServico(formatarMoeda(e.target.value))}
              placeholder="R$ 0,00"
              inputMode="numeric"
              required
            />
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
