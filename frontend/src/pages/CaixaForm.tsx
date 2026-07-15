import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Send, Lock } from "lucide-react";
import { obterCaixa, abrirCaixa, atualizarCaixa, MovimentoCaixa, ORIGEM_MOVIMENTO } from "../api/caixa";
import { focarProximoCampoAoEnter } from "../utils/form";
import { ItemMenu } from "../api/menu";
import { decodeToken } from "../utils/jwt";
import CaixaFecharModal from "./CaixaFecharModal";
import "./UsuarioForm.css";
import "./CaixaForm.css";

interface CaixaFormProps {
  id: number | null;
  onVoltar: () => void;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
  permissoes?: ItemMenu["permissoes"] | null;
}

interface UsuarioLogado {
  id: number;
  nome: string;
  login: string;
}

function usuarioLogado(): UsuarioLogado | null {
  const token = sessionStorage.getItem("token");
  if (!token) return null;
  return decodeToken<UsuarioLogado>(token);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function paraInputDate(valor: string | null): string {
  return valor ? valor.slice(0, 10) : "";
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

function moedaParaNumero(valor: string): number {
  const limpo = valor.replace(/[^\d,]/g, "").replace(",", ".");
  return limpo ? Number(limpo) : 0;
}

function pad6(valor: number): string {
  return String(valor).padStart(6, "0");
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function CaixaForm({ id, onVoltar, permissoes }: CaixaFormProps) {
  const modoEdicao = id !== null;
  const usuario = usuarioLogado();

  const [dataAbertura, setDataAbertura] = useState(hoje());
  const [saldoInicial, setSaldoInicial] = useState("");
  const [nomeUsuarioAbertura, setNomeUsuarioAbertura] = useState("");
  const [dataFechamento, setDataFechamento] = useState<string | null>(null);
  const [saldoFinal, setSaldoFinal] = useState<number | null>(null);
  const [nomeUsuarioFechamento, setNomeUsuarioFechamento] = useState("");
  const [observacao, setObservacao] = useState("");

  const [movimentos, setMovimentos] = useState<MovimentoCaixa[]>([]);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarFechar, setMostrarFechar] = useState(false);

  const aberto = !dataFechamento;
  const podeEditar = permissoes?.editar ?? false;

  async function carregarCaixa() {
    if (id === null) return;
    const c = await obterCaixa(id);
    setDataAbertura(paraInputDate(c.DataAbertura));
    setSaldoInicial(numeroParaMoeda(c.SaldoInicial));
    setNomeUsuarioAbertura(c.NomeUsuarioAbertura || "");
    setDataFechamento(c.DataFechamento);
    setSaldoFinal(c.SaldoFinal);
    setNomeUsuarioFechamento(c.NomeUsuarioFechamento || "");
    setObservacao(c.Observacao || "");
    setMovimentos(c.movimentos);
  }

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    carregarCaixa().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, modoEdicao]);

  async function handleFechado() {
    setMostrarFechar(false);
    await carregarCaixa();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!dataAbertura) {
      setErro("Informe a data de abertura");
      return;
    }

    const dados = {
      dataAbertura,
      saldoInicial: moedaParaNumero(saldoInicial),
      observacao: observacao || undefined,
    };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarCaixa(id, dados);
      } else {
        await abrirCaixa(dados);
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar o caixa");
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
        <h2>{modoEdicao ? `Caixa nº ${pad6(id!)}` : "Abrir Caixa"}</h2>
        {modoEdicao && (
          <span className={`caixa-form-badge ${aberto ? "aberto" : "fechado"}`}>
            {aberto ? "ABERTO" : "FECHADO"}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form">
        <div className="usuario-form-linha">
          <div className="usuario-form-campo caixa-form-campo-data">
            <label htmlFor="cx-data-abertura">
              Data Abertura <span className="obrigatorio">*</span>
            </label>
            <input
              id="cx-data-abertura"
              type="date"
              value={dataAbertura}
              onChange={(e) => setDataAbertura(e.target.value)}
              disabled={!aberto}
              required
            />
          </div>

          <div className="usuario-form-campo caixa-form-campo-valor">
            <label htmlFor="cx-saldo-inicial">Saldo Inicial</label>
            <input
              id="cx-saldo-inicial"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(formatarMoeda(e.target.value))}
              placeholder="R$ 0,00"
              inputMode="numeric"
              disabled={!aberto}
            />
          </div>

          <div className="usuario-form-campo">
            <label>Usuário de Abertura</label>
            <input
              value={modoEdicao ? nomeUsuarioAbertura : usuario ? `${pad6(usuario.id)} - ${usuario.nome}` : ""}
              disabled
              readOnly
            />
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo caixa-form-campo-data">
            <label>Data Fechamento</label>
            <input value={dataFechamento ? new Date(dataFechamento).toLocaleString("pt-BR") : ""} disabled readOnly />
          </div>

          <div className="usuario-form-campo caixa-form-campo-valor">
            <label>Saldo Final</label>
            <input value={saldoFinal !== null ? numeroParaMoeda(saldoFinal) : ""} disabled readOnly />
          </div>

          <div className="usuario-form-campo">
            <label>Usuário de Fechamento</label>
            <input value={nomeUsuarioFechamento} disabled readOnly />
          </div>
        </div>

        <div className="usuario-form-campo">
          <label htmlFor="cx-observacao">Observações</label>
          <textarea
            id="cx-observacao"
            className="caixa-form-textarea"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            disabled={!aberto}
          />
        </div>

        {erro && <div className="usuario-form-erro">{erro}</div>}

        {aberto && (
          <div className="caixa-form-acoes">
            <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
              <Send size={16} />
            </button>
            {modoEdicao && podeEditar && (
              <button
                type="button"
                className="caixa-form-btn-fechar"
                disabled={salvando}
                onClick={() => setMostrarFechar(true)}
              >
                <Lock size={16} />
                Fechar Caixa
              </button>
            )}
          </div>
        )}
      </form>

      {modoEdicao && movimentos.length > 0 && (
        <div className="caixa-form-movimentos">
          <h3>Movimentos</h3>
          <div className="caixa-form-movimentos-tabela-wrapper">
            <table className="caixa-form-movimentos-tabela">
              <thead>
                <tr>
                  <th>Mov. Nº</th>
                  <th>Tipo</th>
                  <th>Data/Hora</th>
                  <th>Tipo Pgto.</th>
                  <th className="caixa-col-valor">Valor</th>
                  <th>Código</th>
                  <th>Origem</th>
                  <th>Descrição</th>
                  <th>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map((m) => (
                  <tr key={m.idMovimento}>
                    <td>{pad6(m.idMovimento)}</td>
                    <td>
                      <span className={`caixa-badge-tipo ${m.TipoMovimento === "E" ? "entrada" : "saida"}`}>
                        {m.TipoMovimento === "E" ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td>{formatarDataHora(m.DataHora)}</td>
                    <td>{m.DescricaoTipoPagamento || "-"}</td>
                    <td className="caixa-col-valor">{numeroParaMoeda(m.Valor)}</td>
                    <td>{m.idOrigem !== null ? pad6(m.idOrigem) : "-"}</td>
                    <td>{ORIGEM_MOVIMENTO[m.TipoOrigem] || "-"}</td>
                    <td className="caixa-form-movimentos-descricao">{m.Descricao || "-"}</td>
                    <td>{m.idusuario !== null ? pad6(m.idusuario) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mostrarFechar && id !== null && (
        <CaixaFecharModal
          idCaixa={id}
          onCancelar={() => setMostrarFechar(false)}
          onFechado={handleFechado}
        />
      )}
    </div>
  );
}

export default CaixaForm;
