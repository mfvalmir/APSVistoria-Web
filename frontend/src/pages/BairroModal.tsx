import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { MoreHorizontal, Save, X } from "lucide-react";
import Modal from "../components/Modal";
import { criarBairro, Bairro } from "../api/bairros";
import { listarCidades, Cidade } from "../api/cidades";
import CidadeModal from "./CidadeModal";
import "./UsuarioForm.css";
import "./BairroModal.css";

interface BairroModalProps {
  onCancelar: () => void;
  onCriada: (bairro: Bairro) => void;
}

function BairroModal({ onCancelar, onCriada }: BairroModalProps) {
  const [descricaoBairro, setDescricaoBairro] = useState("");
  const [idCidade, setIdCidade] = useState<number | null>(null);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [mostrarModalCidade, setMostrarModalCidade] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    listarCidades().then(setCidades);
  }, []);

  function handleCidadeCriada(cidade: Cidade) {
    setCidades((atual) => [...atual, cidade].sort((a, b) => a.DescricaoCidade.localeCompare(b.DescricaoCidade)));
    setIdCidade(cidade.idCidade);
    setMostrarModalCidade(false);
  }

  async function salvar() {
    if (salvando) return;
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!descricaoBairro.trim()) novosErros.descricaoBairro = "Informe o bairro";
    if (!idCidade) novosErros.idCidade = "Informe a cidade";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || !idCidade) return;

    setSalvando(true);
    try {
      const { IDBairro } = await criarBairro({ descricaoBairro: descricaoBairro.trim(), idCidade });
      const cidade = cidades.find((c) => c.idCidade === idCidade);
      onCriada({
        IDBairro,
        DescricaoBairro: descricaoBairro.trim(),
        idCidade,
        DescricaoCidade: cidade?.DescricaoCidade ?? null,
        UF: cidade?.UF ?? null,
      });
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

  return (
    <Modal titulo="Novo Bairro" onFechar={onCancelar}>
      <form
        className="usuario-form bairro-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        noValidate
      >
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.descricaoBairro ? "campo-invalido" : ""}`}>
            <label htmlFor="bm-descricao">
              Bairro <span className="obrigatorio">*</span>
            </label>
            <input
              id="bm-descricao"
              value={descricaoBairro}
              onChange={(e) => {
                setDescricaoBairro(e.target.value);
                if (erros.descricaoBairro) setErros((atual) => ({ ...atual, descricaoBairro: "" }));
              }}
              placeholder="Digite o nome do bairro"
              maxLength={100}
              autoFocus
              required
            />
            {erros.descricaoBairro && <span className="usuario-form-campo-erro">{erros.descricaoBairro}</span>}
          </div>

          <div className={`usuario-form-campo ${erros.idCidade ? "campo-invalido" : ""}`}>
            <label htmlFor="bm-cidade">
              Cidade <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="bm-cidade"
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

        <div className="bairro-modal-acoes">
          <button type="submit" className="bairro-modal-btn-salvar" disabled={salvando}>
            <Save size={16} />
            {salvando ? "Salvando..." : "Criar Bairro"}
          </button>
          <button type="button" className="bairro-modal-btn-cancelar" onClick={onCancelar} disabled={salvando}>
            <X size={16} />
            Cancelar
          </button>
        </div>
      </form>

      {mostrarModalCidade && (
        <CidadeModal onCancelar={() => setMostrarModalCidade(false)} onCriada={handleCidadeCriada} />
      )}
    </Modal>
  );
}

export default BairroModal;
