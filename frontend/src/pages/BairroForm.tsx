import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, MoreHorizontal, Send } from "lucide-react";
import { obterBairro, criarBairro, atualizarBairro } from "../api/bairros";
import { listarCidades, Cidade } from "../api/cidades";
import { focarProximoCampoAoEnter } from "../utils/form";
import { useToast } from "../contexts/ToastContext";
import CidadeModal from "./CidadeModal";
import "./UsuarioForm.css";

interface BairroFormProps {
  id: number | null;
  onVoltar: () => void;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
}

function BairroForm({ id, onVoltar }: BairroFormProps) {
  const modoEdicao = id !== null;

  const [descricaoBairro, setDescricaoBairro] = useState("");
  const [idCidade, setIdCidade] = useState<number | null>(null);

  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [mostrarModalCidade, setMostrarModalCidade] = useState(false);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();

  useEffect(() => {
    listarCidades().then(setCidades);
  }, []);

  function handleCidadeCriada(cidade: Cidade) {
    setCidades((atual) => [...atual, cidade].sort((a, b) => a.DescricaoCidade.localeCompare(b.DescricaoCidade)));
    setIdCidade(cidade.idCidade);
    setMostrarModalCidade(false);
  }

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

    const novosErros: Record<string, string> = {};
    if (!descricaoBairro.trim()) novosErros.descricaoBairro = "Informe o bairro";
    if (!idCidade) novosErros.idCidade = "Informe a cidade";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || !idCidade) return;

    const dados = { descricaoBairro, idCidade };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarBairro(id, dados);
        mostrarToast("Bairro atualizado com sucesso", "sucesso");
      } else {
        await criarBairro(dados);
        mostrarToast("Bairro criado com sucesso", "sucesso");
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

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.descricaoBairro ? "campo-invalido" : ""}`}>
            <label htmlFor="bf-descricao">
              Bairro <span className="obrigatorio">*</span>
            </label>
            <input
              id="bf-descricao"
              value={descricaoBairro}
              onChange={(e) => {
                setDescricaoBairro(e.target.value);
                if (erros.descricaoBairro) setErros((atual) => ({ ...atual, descricaoBairro: "" }));
              }}
              placeholder="Digite o nome do bairro"
              maxLength={100}
              required
            />
            {erros.descricaoBairro && <span className="usuario-form-campo-erro">{erros.descricaoBairro}</span>}
          </div>

          <div className={`usuario-form-campo ${erros.idCidade ? "campo-invalido" : ""}`}>
            <label htmlFor="bf-cidade">
              Cidade <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="bf-cidade"
                value={idCidade ?? ""}
                onChange={(e) => {
                  setIdCidade(e.target.value ? Number(e.target.value) : null);
                  if (erros.idCidade) setErros((atual) => ({ ...atual, idCidade: "" }));
                }}
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
                title="Cadastrar nova cidade"
                aria-label="Cadastrar nova cidade"
                onClick={() => setMostrarModalCidade(true)}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
            {erros.idCidade && <span className="usuario-form-campo-erro">{erros.idCidade}</span>}
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Bairro"}
          <Send size={16} />
        </button>
      </form>

      {mostrarModalCidade && (
        <CidadeModal onCancelar={() => setMostrarModalCidade(false)} onCriada={handleCidadeCriada} />
      )}
    </div>
  );
}

export default BairroForm;
