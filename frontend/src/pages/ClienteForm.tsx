import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send, Plus, Pencil, Trash2 } from "lucide-react";
import { obterCliente, criarCliente, atualizarCliente } from "../api/clientes";
import {
  listarResponsaveis,
  criarResponsavel,
  atualizarResponsavel,
  excluirResponsavel,
  Responsavel,
} from "../api/responsaveis";
import { focarProximoCampoAoEnter } from "../utils/form";
import { validarCPF, validarCNPJ } from "../utils/documento";
import "./UsuarioForm.css";
import "./ClienteForm.css";

interface ClienteFormProps {
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

function formatarCpfCnpj(valor: string, tipoPessoa: "F" | "J"): string {
  return tipoPessoa === "J" ? formatarCNPJ(valor) : formatarCPF(valor);
}

function ClienteForm({ id, onVoltar }: ClienteFormProps) {
  // Estado próprio (não só a prop `id`): ao criar um cliente novo e o usuário optar por
  // adicionar um responsável na hora, o form muda pra modo edição sem trocar de tela.
  const [idAtual, setIdAtual] = useState(id);
  const modoEdicao = idAtual !== null;

  const [nomeCliente, setNomeCliente] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState<"F" | "J">("F");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [tipoCliente, setTipoCliente] = useState("");
  const [observacao, setObservacao] = useState("");

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [carregandoResponsaveis, setCarregandoResponsaveis] = useState(false);
  const [formResponsavelAberto, setFormResponsavelAberto] = useState(false);
  const [responsavelEditandoId, setResponsavelEditandoId] = useState<number | null>(null);
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [docResponsavel, setDocResponsavel] = useState("");
  const [celularResponsavel, setCelularResponsavel] = useState("");
  const [erroResponsavel, setErroResponsavel] = useState("");
  const [salvandoResponsavel, setSalvandoResponsavel] = useState(false);

  useEffect(() => {
    if (!modoEdicao || idAtual === null) return;
    obterCliente(idAtual)
      .then((c) => {
        setNomeCliente(c.NomeCliente);
        setTipoPessoa(c.TipoPessoa);
        setCpfCnpj(formatarCpfCnpj(c.CpfCnpj, c.TipoPessoa));
        setTipoCliente(c.TipoCliente || "");
        setObservacao(c.Observacao || "");
      })
      .finally(() => setCarregando(false));
  }, [idAtual, modoEdicao]);

  async function carregarResponsaveis() {
    if (idAtual === null) return;
    setCarregandoResponsaveis(true);
    try {
      const dados = await listarResponsaveis(idAtual);
      setResponsaveis(dados);
    } finally {
      setCarregandoResponsaveis(false);
    }
  }

  useEffect(() => {
    if (modoEdicao) carregarResponsaveis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAtual, modoEdicao]);

  function abrirNovoResponsavel() {
    setResponsavelEditandoId(null);
    setNomeResponsavel("");
    setDocResponsavel("");
    setCelularResponsavel("");
    setErroResponsavel("");
    setFormResponsavelAberto(true);
  }

  function abrirEdicaoResponsavel(r: Responsavel) {
    setResponsavelEditandoId(r.idResponsavel);
    setNomeResponsavel(r.NomeResponsavel);
    setDocResponsavel(r.DocResponsavel ? formatarCPF(r.DocResponsavel) : "");
    setCelularResponsavel(r.CelularResponsavel || "");
    setErroResponsavel("");
    setFormResponsavelAberto(true);
  }

  async function salvarResponsavel(e: React.FormEvent) {
    e.preventDefault();
    setErroResponsavel("");

    if (!nomeResponsavel) {
      setErroResponsavel("Informe o nome do responsável");
      return;
    }
    if (docResponsavel && !validarCPF(docResponsavel)) {
      setErroResponsavel("CPF inválido");
      return;
    }
    if (idAtual === null) return;

    const dados = {
      nomeResponsavel,
      docResponsavel: docResponsavel ? docResponsavel.replace(/\D/g, "") : undefined,
      celularResponsavel: celularResponsavel || undefined,
    };

    setSalvandoResponsavel(true);
    try {
      if (responsavelEditandoId !== null) {
        await atualizarResponsavel(idAtual, responsavelEditandoId, dados);
      } else {
        await criarResponsavel(idAtual, dados);
      }
      setFormResponsavelAberto(false);
      await carregarResponsaveis();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErroResponsavel(err.response.data?.erro || "Não foi possível salvar o responsável");
      } else {
        setErroResponsavel("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setSalvandoResponsavel(false);
    }
  }

  async function handleExcluirResponsavel(r: Responsavel) {
    if (idAtual === null) return;
    if (!window.confirm(`Excluir o responsável "${r.NomeResponsavel}"?`)) return;
    try {
      await excluirResponsavel(idAtual, r.idResponsavel);
      carregarResponsaveis();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        window.alert(err.response.data?.erro || "Não foi possível excluir o responsável");
      } else {
        window.alert("Não foi possível conectar ao servidor. Tente novamente.");
      }
    }
  }

  function handleTipoPessoaChange(novoTipo: "F" | "J") {
    setTipoPessoa(novoTipo);
    setCpfCnpj((atual) => formatarCpfCnpj(atual, novoTipo));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!nomeCliente || !cpfCnpj) {
      setErro("Informe o nome e o CPF/CNPJ");
      return;
    }
    if (tipoPessoa === "F" && !validarCPF(cpfCnpj)) {
      setErro("CPF inválido");
      return;
    }
    if (tipoPessoa === "J" && !validarCNPJ(cpfCnpj)) {
      setErro("CNPJ inválido");
      return;
    }

    const dados = {
      nomeCliente,
      tipoPessoa,
      cpfCnpj: cpfCnpj.replace(/\D/g, ""),
      tipoCliente: tipoCliente || undefined,
      observacao: observacao || undefined,
    };

    setSalvando(true);
    try {
      if (modoEdicao && idAtual !== null) {
        await atualizarCliente(idAtual, dados);
        onVoltar();
      } else {
        const novoId = await criarCliente(dados);
        const querAdicionarResponsavel = window.confirm(
          "Cliente criado com sucesso! Deseja adicionar um responsável a este cliente agora?"
        );
        if (querAdicionarResponsavel) {
          setIdAtual(novoId);
          abrirNovoResponsavel();
        } else {
          onVoltar();
        }
      }
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o cliente");
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
        <h2>{modoEdicao ? "Editar Cliente" : "Novo Cliente"}</h2>
      </div>

      <form id="cliente-form" onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form">
        <div className="usuario-form-linha">
          <div className="usuario-form-campo">
            <label htmlFor="cf-nome">
              Nome <span className="obrigatorio">*</span>
            </label>
            <input
              id="cf-nome"
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              placeholder="Digite o nome do cliente"
              maxLength={50}
              required
            />
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="cf-tipo-pessoa">
              Tipo Pessoa <span className="obrigatorio">*</span>
            </label>
            <select
              id="cf-tipo-pessoa"
              value={tipoPessoa}
              onChange={(e) => handleTipoPessoaChange(e.target.value as "F" | "J")}
            >
              <option value="F">Física</option>
              <option value="J">Jurídica</option>
            </select>
          </div>

          <div className="usuario-form-campo cliente-form-campo-documento">
            <label htmlFor="cf-documento">
              {tipoPessoa === "J" ? "CNPJ" : "CPF"} <span className="obrigatorio">*</span>
            </label>
            <input
              id="cf-documento"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatarCpfCnpj(e.target.value, tipoPessoa))}
              placeholder={tipoPessoa === "J" ? "00.000.000/0000-00" : "000.000.000-00"}
              inputMode="numeric"
              maxLength={18}
              required
            />
          </div>

          <div className="usuario-form-campo usuario-form-campo-status">
            <label htmlFor="cf-tipo-cliente">Categoria</label>
            <select id="cf-tipo-cliente" value={tipoCliente} onChange={(e) => setTipoCliente(e.target.value)}>
              <option value="">Não informado</option>
              <option value="Particular">Particular</option>
              <option value="Parceiro">Parceiro</option>
            </select>
          </div>
        </div>

        <div className="usuario-form-campo">
          <label htmlFor="cf-observacao">Observação</label>
          <textarea
            id="cf-observacao"
            className="cliente-form-textarea"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={4}
          />
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}
      </form>

      {!modoEdicao && (
        <div className="cliente-responsaveis-aviso">
          Salve o cliente primeiro para poder adicionar responsáveis.
        </div>
      )}

      {modoEdicao && (
        <div className="cliente-responsaveis">
          <div className="cliente-responsaveis-cabecalho">
            <h3>Responsáveis</h3>
            {!formResponsavelAberto && (
              <button
                type="button"
                className="cliente-responsaveis-btn-adicionar"
                onClick={abrirNovoResponsavel}
              >
                <Plus size={16} />
                Adicionar Responsável
              </button>
            )}
          </div>

          {formResponsavelAberto && (
            <form onSubmit={salvarResponsavel} className="cliente-responsaveis-form">
              <div className="usuario-form-linha">
                <div className="usuario-form-campo">
                  <label htmlFor="rf-nome">
                    Nome <span className="obrigatorio">*</span>
                  </label>
                  <input
                    id="rf-nome"
                    value={nomeResponsavel}
                    onChange={(e) => setNomeResponsavel(e.target.value)}
                    placeholder="Digite o nome do responsável"
                    maxLength={50}
                    required
                  />
                </div>

                <div className="usuario-form-campo cliente-form-campo-documento">
                  <label htmlFor="rf-doc">CPF</label>
                  <input
                    id="rf-doc"
                    value={docResponsavel}
                    onChange={(e) => setDocResponsavel(formatarCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                  />
                </div>

                <div className="usuario-form-campo usuario-form-campo-status">
                  <label htmlFor="rf-celular">Celular</label>
                  <input
                    id="rf-celular"
                    value={celularResponsavel}
                    onChange={(e) => setCelularResponsavel(e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>

              {erroResponsavel && <div className="usuario-form-erro">{erroResponsavel}</div>}

              <div className="cliente-responsaveis-form-acoes">
                <button type="submit" className="usuario-form-btn-salvar" disabled={salvandoResponsavel}>
                  {salvandoResponsavel ? "Salvando..." : "Salvar Responsável"}
                  <Send size={16} />
                </button>
                <button
                  type="button"
                  className="cliente-responsaveis-btn-cancelar"
                  onClick={() => setFormResponsavelAberto(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {carregandoResponsaveis ? (
            <div className="cliente-responsaveis-vazio">Carregando...</div>
          ) : responsaveis.length === 0 ? (
            !formResponsavelAberto && (
              <div className="cliente-responsaveis-vazio">Nenhum responsável cadastrado.</div>
            )
          ) : (
            <table className="cliente-responsaveis-tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Celular</th>
                  <th className="cliente-responsaveis-col-acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {responsaveis.map((r) => (
                  <tr key={r.idResponsavel}>
                    <td>{r.NomeResponsavel}</td>
                    <td>{r.DocResponsavel ? formatarCPF(r.DocResponsavel) : "-"}</td>
                    <td>{r.CelularResponsavel || "-"}</td>
                    <td className="cliente-responsaveis-col-acoes">
                      <button
                        type="button"
                        className="cliente-responsaveis-icone-acao editar"
                        title="Editar"
                        onClick={() => abrirEdicaoResponsavel(r)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="cliente-responsaveis-icone-acao perigo"
                        title="Excluir"
                        onClick={() => handleExcluirResponsavel(r)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="cliente-form-acao-salvar">
        <button type="submit" form="cliente-form" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Cliente"}
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

export default ClienteForm;
