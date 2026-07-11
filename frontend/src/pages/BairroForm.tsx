import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, ExternalLink, Send } from "lucide-react";
import { obterBairro, criarBairro, atualizarBairro } from "../api/bairros";
import { listarCidades, Cidade } from "../api/cidades";
import { focarProximoCampoAoEnter } from "../utils/form";
import "./UsuarioForm.css";

interface BairroFormProps {
  id: number | null;
  onVoltar: () => void;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
}

function BairroForm({ id, onVoltar, navegarPara }: BairroFormProps) {
  const modoEdicao = id !== null;

  const [descricaoBairro, setDescricaoBairro] = useState("");
  const [idCidade, setIdCidade] = useState<number | null>(null);

  const [cidades, setCidades] = useState<Cidade[]>([]);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    listarCidades().then(setCidades);
  }, []);

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterBairro(id)
      .then((b) => {
        setDescricaoBairro(b.DescricaoBairro);
        setIdCidade(b.idCidade);
      })
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!descricaoBairro || !idCidade) {
      setErro("Informe o bairro e a cidade");
      return;
    }

    const dados = { descricaoBairro, idCidade };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarBairro(id, dados);
      } else {
        await criarBairro(dados);
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o bairro");
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
        <h2>{modoEdicao ? "Editar Bairro" : "Novo Bairro"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form">
        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="bf-descricao">
              Bairro <span className="obrigatorio">*</span>
            </label>
            <input
              id="bf-descricao"
              value={descricaoBairro}
              onChange={(e) => setDescricaoBairro(e.target.value)}
              placeholder="Digite o nome do bairro"
              maxLength={100}
              required
            />
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="bf-cidade">
              Cidade <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="bf-cidade"
                value={idCidade ?? ""}
                onChange={(e) => setIdCidade(e.target.value ? Number(e.target.value) : null)}
                required
              >
                <option value="">Selecione...</option>
                {cidades.map((c) => (
                  <option key={c.idCidade} value={c.idCidade}>
                    {c.DescricaoCidade}/{c.UF}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Ir para Cadastro de Cidades"
                onClick={() => navegarPara?.("cidades", "Cadastro de Cidades", "Cadastros")}
              >
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Bairro"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default BairroForm;
