import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send } from "lucide-react";
import { obterTipoPagamento, criarTipoPagamento, atualizarTipoPagamento } from "../api/tipoPagamento";
import { focarProximoCampoAoEnter } from "../utils/form";
import "./UsuarioForm.css";

interface TipoPagamentoFormProps {
  id: number | null;
  onVoltar: () => void;
}

function TipoPagamentoForm({ id, onVoltar }: TipoPagamentoFormProps) {
  const modoEdicao = id !== null;

  const [descricaoTipoPagamento, setDescricaoTipoPagamento] = useState("");

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterTipoPagamento(id)
      .then((t) => setDescricaoTipoPagamento(t.DescricaoTipoPagamento))
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!descricaoTipoPagamento) {
      setErro("Informe a descrição");
      return;
    }

    const dados = { descricaoTipoPagamento };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarTipoPagamento(id, dados);
      } else {
        await criarTipoPagamento(dados);
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o tipo de pagamento");
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
        <h2>{modoEdicao ? "Editar Tipo de Pagamento" : "Novo Tipo de Pagamento"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form">
        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="tpf-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="tpf-descricao"
              value={descricaoTipoPagamento}
              onChange={(e) => setDescricaoTipoPagamento(e.target.value)}
              placeholder="Digite a descrição do tipo de pagamento"
              maxLength={30}
              required
            />
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Tipo de Pagamento"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default TipoPagamentoForm;
