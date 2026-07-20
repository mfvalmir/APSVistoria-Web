import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send } from "lucide-react";
import {
  obterFormulario,
  criarFormulario,
  atualizarFormulario,
  buscarGrupos,
} from "../api/formularios";
import { getIcone, NOMES_ICONES } from "../components/iconRegistry";
import { focarProximoCampoAoEnter } from "../utils/form";
import { useToast } from "../contexts/ToastContext";
import "./UsuarioForm.css";
import "./FormularioForm.css";

interface FormularioFormProps {
  id: number | null;
  onVoltar: () => void;
}

function FormularioForm({ id, onVoltar }: FormularioFormProps) {
  const modoEdicao = id !== null;

  const [nomeFormulario, setNomeFormulario] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState<"A" | "I">("A");
  const [grupo, setGrupo] = useState("");
  const [ordem, setOrdem] = useState("");
  const [icone, setIcone] = useState("");

  const [grupos, setGrupos] = useState<string[]>([]);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();

  useEffect(() => {
    buscarGrupos().then(setGrupos);
  }, []);

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    obterFormulario(id)
      .then((f) => {
        setNomeFormulario(f.NomeFormulario);
        setDescricao(f.Descricao || "");
        setAtivo(f.Ativo.trim() === "I" ? "I" : "A");
        setGrupo(f.Grupo || "");
        setOrdem(f.Ordem != null ? String(f.Ordem) : "");
        setIcone(f.Icone || "");
      })
      .finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const novosErros: Record<string, string> = {};
    if (!nomeFormulario.trim()) novosErros.nomeFormulario = "Informe o nome do formulário";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = {
      nomeFormulario,
      descricao: descricao || undefined,
      grupo: grupo || undefined,
      ordem: ordem ? Number(ordem) : null,
      icone: icone || undefined,
    };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarFormulario(id, { ...dados, ativo });
        mostrarToast("Formulário atualizado com sucesso", "sucesso");
      } else {
        await criarFormulario(dados);
        mostrarToast("Formulário criado com sucesso", "sucesso");
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o formulário");
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

  const IconePreview = getIcone(icone || null);

  return (
    <div className="usuario-form-pagina">
      <div className="usuario-form-cabecalho">
        <button className="usuario-form-voltar" onClick={onVoltar} type="button">
          <ArrowLeft size={18} />
        </button>
        <h2>{modoEdicao ? "Editar Formulário" : "Novo Formulário"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className={`usuario-form-campo ${erros.nomeFormulario ? "campo-invalido" : ""}`}>
            <label htmlFor="mf-nome">
              Nome <span className="obrigatorio">*</span>
            </label>
            <input
              id="mf-nome"
              value={nomeFormulario}
              onChange={(e) => {
                setNomeFormulario(e.target.value);
                if (erros.nomeFormulario) setErros((atual) => ({ ...atual, nomeFormulario: "" }));
              }}
              placeholder="frmNomeDaTela"
              required
            />
            {erros.nomeFormulario && <span className="usuario-form-campo-erro">{erros.nomeFormulario}</span>}
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="mf-descricao">Descrição</label>
            <input
              id="mf-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Nome exibido no menu"
            />
          </div>

          {modoEdicao && (
            <div className="usuario-form-campo usuario-form-campo-status">
              <label htmlFor="mf-ativo">
                Status <span className="obrigatorio">*</span>
              </label>
              <select id="mf-ativo" value={ativo} onChange={(e) => setAtivo(e.target.value as "A" | "I")}>
                <option value="A">Ativo</option>
                <option value="I">Inativo</option>
              </select>
            </div>
          )}
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="mf-grupo">Grupo</label>
            <input
              id="mf-grupo"
              list="mf-grupos"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Ex.: Cadastros"
            />
            <datalist id="mf-grupos">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="mf-icone">Ícone</label>
            <div className="formulario-form-icone-linha">
              <select id="mf-icone" value={icone} onChange={(e) => setIcone(e.target.value)}>
                <option value="">Selecione...</option>
                {NOMES_ICONES.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
              <span className="formulario-form-icone-preview">
                <IconePreview size={18} />
              </span>
            </div>
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="mf-ordem">Ordem</label>
            <input
              id="mf-ordem"
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Formulário"}
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default FormularioForm;
