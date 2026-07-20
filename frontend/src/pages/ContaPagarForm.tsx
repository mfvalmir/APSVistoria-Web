import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, MoreHorizontal, Send, Banknote, Undo2 } from "lucide-react";
import {
  obterContaPagar,
  criarContaPagar,
  atualizarContaPagar,
  STATUS_CONTA_PAGAR,
  ParcelaContaPagar,
} from "../api/contaPagar";
import { listarFornecedores, Fornecedor } from "../api/fornecedores";
import { listarCategorias, Categoria } from "../api/categoria";
import { listarTiposPagamentoPadrao, TipoPagamento } from "../api/tipoPagamento";
import { focarProximoCampoAoEnter } from "../utils/form";
import { ItemMenu } from "../api/menu";
import ContaPagarBaixaModal from "./ContaPagarBaixaModal";
import ContaPagarEstornoModal from "./ContaPagarEstornoModal";
import FornecedorModal from "./FornecedorModal";
import CategoriaModal from "./CategoriaModal";
import TipoPagamentoModal from "./TipoPagamentoModal";
import { useToast } from "../contexts/ToastContext";
import "./UsuarioForm.css";
import "./ContaPagarForm.css";

interface ContaPagarFormProps {
  id: number | null;
  onVoltar: () => void;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
  permissoes?: ItemMenu["permissoes"] | null;
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

function statusParcelaInfo(idStatus: number): { label: string; classe: string } {
  const item = STATUS_CONTA_PAGAR.find((s) => s.valor === idStatus);
  const classes: Record<number, string> = { 0: "pendente", 1: "pago", 2: "parcial", 3: "cancelado" };
  return { label: item?.label ?? "-", classe: classes[idStatus] ?? "pendente" };
}

function pad3(valor: number): string {
  return String(valor).padStart(3, "0");
}

function parcelaPaga(p: ParcelaContaPagar): boolean {
  return p.IdStatusParcela !== 0 || p.ValorPago > 0 || !!p.DataPagamento;
}

function classeVencimento(dataVencimento: string, paga: boolean): string {
  if (paga) return "";
  const venc = dataVencimento.slice(0, 10);
  const hojeStr = new Date().toISOString().slice(0, 10);
  if (venc < hojeStr) return "conta-pagar-vencimento-vencida";
  if (venc === hojeStr) return "conta-pagar-vencimento-hoje";
  return "";
}

function parcelaEstornada(p: ParcelaContaPagar): boolean {
  return !!p.Observacao?.startsWith("[Estorno");
}

function ContaPagarForm({ id, onVoltar, navegarPara, permissoes }: ContaPagarFormProps) {
  const modoEdicao = id !== null;

  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [idFornecedor, setIdFornecedor] = useState<number | null>(null);
  const [nomeFornecedor, setNomeFornecedor] = useState("");
  const [idCategoria, setIdCategoria] = useState<number | null>(null);
  const [valorTotal, setValorTotal] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("1");
  const [primeiroVencimento, setPrimeiroVencimento] = useState("");
  const [idPrimeiroTipoPagamento, setIdPrimeiroTipoPagamento] = useState<number | null>(null);
  const [intervaloMeses, setIntervaloMeses] = useState("1");
  const [idStatusContaPagar, setIdStatusContaPagar] = useState(0);
  const [dataEmissao, setDataEmissao] = useState(hoje());
  const [observacao, setObservacao] = useState("");
  const [recalcularParcelas, setRecalcularParcelas] = useState(false);

  const [saldoDevedor, setSaldoDevedor] = useState<number | null>(null);
  const [parcelas, setParcelas] = useState<ParcelaContaPagar[]>([]);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([]);
  const [sugestoesFornecedor, setSugestoesFornecedor] = useState<Fornecedor[]>([]);
  const [mostrarSugestoesFornecedor, setMostrarSugestoesFornecedor] = useState(false);
  const [mostrarModalFornecedor, setMostrarModalFornecedor] = useState(false);
  const [mostrarModalCategoria, setMostrarModalCategoria] = useState(false);
  const [mostrarModalTipoPagamento, setMostrarModalTipoPagamento] = useState(false);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();

  const [parcelaEmBaixa, setParcelaEmBaixa] = useState<ParcelaContaPagar | null>(null);
  const [parcelaEmEstorno, setParcelaEmEstorno] = useState<ParcelaContaPagar | null>(null);

  const algumaParcelaPaga = parcelas.some(parcelaPaga);
  const podeBaixarParcela = permissoes?.baixarParCP ?? false;
  const podeEstornarParcela = permissoes?.estornarParCP ?? false;

  useEffect(() => {
    listarCategorias().then(setCategorias);
    listarTiposPagamentoPadrao().then(setTiposPagamento);
  }, []);

  async function carregarConta() {
    if (id === null) return;
    const c = await obterContaPagar(id);
    setNumeroDocumento(c.NumeroDocumento || "");
    setDescricao(c.Descricao);
    setIdFornecedor(c.idFornecedor);
    setNomeFornecedor(c.RazaoSocial || "");
    setIdCategoria(c.idCategoria);
    setValorTotal(numeroParaMoeda(c.ValorTotal));
    setTotalParcelas(String(c.TotalParcelas));
    setPrimeiroVencimento(paraInputDate(c.DataPrimeiraParcela));
    setIdPrimeiroTipoPagamento(c.IdPrimeiroTipoPagamento);
    setIntervaloMeses(String(c.IntervaloMeses ?? 1));
    setIdStatusContaPagar(c.IdStatusContaPagar);
    setDataEmissao(paraInputDate(c.DataEmissao));
    setObservacao(c.Observacao || "");
    setSaldoDevedor(c.SaldoDevedor);
    setParcelas(c.parcelas);
  }

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    carregarConta().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, modoEdicao]);

  async function handleParcelaBaixada() {
    setParcelaEmBaixa(null);
    await carregarConta();
    mostrarToast("Parcela baixada com sucesso", "sucesso");
  }

  async function handleParcelaEstornada() {
    setParcelaEmEstorno(null);
    await carregarConta();
    mostrarToast("Baixa estornada com sucesso", "sucesso");
  }

  useEffect(() => {
    if (!nomeFornecedor || (idFornecedor && nomeFornecedor === "")) {
      setSugestoesFornecedor([]);
      return;
    }
    const timeout = setTimeout(() => {
      listarFornecedores(nomeFornecedor, "A").then(setSugestoesFornecedor);
    }, 250);
    return () => clearTimeout(timeout);
  }, [nomeFornecedor, idFornecedor]);

  function selecionarFornecedor(f: Fornecedor) {
    setIdFornecedor(f.idFornecedor);
    setNomeFornecedor(f.RazaoSocial);
    setSugestoesFornecedor([]);
    setMostrarSugestoesFornecedor(false);
  }

  function handleFornecedorCriado(f: Fornecedor) {
    selecionarFornecedor(f);
    setMostrarModalFornecedor(false);
  }

  function handleCategoriaCriada(c: Categoria) {
    setCategorias((atual) => [...atual, c].sort((a, b) => a.DescricaoCategoria.localeCompare(b.DescricaoCategoria)));
    setIdCategoria(c.IdCategoria);
    setMostrarModalCategoria(false);
  }

  function handleTipoPagamentoCriado(t: TipoPagamento) {
    setTiposPagamento((atual) =>
      [...atual, t].sort((a, b) => a.DescricaoTipoPagamento.localeCompare(b.DescricaoTipoPagamento))
    );
    setIdPrimeiroTipoPagamento(t.idTipoPagamento);
    setMostrarModalTipoPagamento(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const valor = moedaParaNumero(valorTotal);
    const parcelasNum = Number(totalParcelas || 0);
    const novosErros: Record<string, string> = {};
    if (!descricao.trim()) novosErros.descricao = "Informe a descrição";
    if (!idCategoria) novosErros.idCategoria = "Informe a categoria";
    if (!valorTotal) {
      novosErros.valorTotal = "Informe o valor total";
    } else if (valor <= 0) {
      novosErros.valorTotal = "O valor total deve ser maior que zero";
    }
    if (!dataEmissao) novosErros.dataEmissao = "Informe a data de emissão";
    if (parcelasNum < 0) novosErros.totalParcelas = "O total de parcelas não pode ser negativo";
    if (!idPrimeiroTipoPagamento) novosErros.idPrimeiroTipoPagamento = "Informe o tipo de pagamento";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || !idCategoria) return;

    const dados = {
      numeroDocumento: numeroDocumento || undefined,
      descricao,
      idFornecedor: idFornecedor ?? undefined,
      idCategoria,
      valorTotal: valor,
      totalParcelas: parcelasNum,
      primeiroVencimento: primeiroVencimento || undefined,
      idPrimeiroTipoPagamento: idPrimeiroTipoPagamento ?? undefined,
      intervaloMeses: intervaloMeses ? Number(intervaloMeses) : undefined,
      idStatusContaPagar,
      dataEmissao,
      observacao: observacao || undefined,
    };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarContaPagar(id, { ...dados, recalcularParcelas: algumaParcelaPaga ? false : recalcularParcelas });
        mostrarToast("Conta a pagar atualizada com sucesso", "sucesso");
      } else {
        await criarContaPagar(dados);
        mostrarToast("Conta a pagar criada com sucesso", "sucesso");
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar a conta a pagar");
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
        <h2>{modoEdicao ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className="usuario-form-campo conta-pagar-form-campo-documento">
            <label htmlFor="cp-numero-documento">Nº Documento</label>
            <input
              id="cp-numero-documento"
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Nº do documento"
              maxLength={50}
            />
          </div>

          <div className={`usuario-form-campo conta-pagar-form-campo-data ${erros.dataEmissao ? "campo-invalido" : ""}`}>
            <label htmlFor="cp-data-emissao">
              Data de Emissão <span className="obrigatorio">*</span>
            </label>
            <input
              id="cp-data-emissao"
              type="date"
              value={dataEmissao}
              onChange={(e) => {
                setDataEmissao(e.target.value);
                if (erros.dataEmissao) setErros((atual) => ({ ...atual, dataEmissao: "" }));
              }}
              required
            />
            {erros.dataEmissao && <span className="usuario-form-campo-erro">{erros.dataEmissao}</span>}
          </div>

          <div className={`usuario-form-campo ${erros.descricao ? "campo-invalido" : ""}`}>
            <label htmlFor="cp-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="cp-descricao"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                if (erros.descricao) setErros((atual) => ({ ...atual, descricao: "" }));
              }}
              placeholder="Digite a descrição"
              maxLength={255}
              required
            />
            {erros.descricao && <span className="usuario-form-campo-erro">{erros.descricao}</span>}
          </div>

          <div className="usuario-form-campo conta-pagar-form-campo-status">
            <label htmlFor="cp-status">Status</label>
            <input
              id="cp-status"
              className={`conta-pagar-form-status-select ${statusParcelaInfo(idStatusContaPagar).classe}`}
              value={statusParcelaInfo(idStatusContaPagar).label}
              disabled
              readOnly
              title="Definido automaticamente pelo sistema, conforme a situação das parcelas"
            />
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo usuario-form-combobox">
            <label htmlFor="cp-fornecedor">Fornecedor</label>
            <div className="usuario-form-campo-com-acao">
              <input
                id="cp-fornecedor"
                value={nomeFornecedor}
                onChange={(e) => {
                  setNomeFornecedor(e.target.value);
                  setIdFornecedor(null);
                  setMostrarSugestoesFornecedor(true);
                }}
                onFocus={() => setMostrarSugestoesFornecedor(true)}
                onBlur={() => setTimeout(() => setMostrarSugestoesFornecedor(false), 150)}
                placeholder="Digite para buscar o fornecedor..."
                autoComplete="off"
              />
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Cadastrar novo fornecedor"
                aria-label="Cadastrar novo fornecedor"
                onClick={() => setMostrarModalFornecedor(true)}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
            {mostrarSugestoesFornecedor && sugestoesFornecedor.length > 0 && (
              <ul className="usuario-form-sugestoes">
                {sugestoesFornecedor.map((f) => (
                  <li key={f.idFornecedor} onMouseDown={() => selecionarFornecedor(f)}>
                    {f.RazaoSocial}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`usuario-form-campo conta-pagar-form-campo-categoria-larga ${erros.idCategoria ? "campo-invalido" : ""}`}>
            <label htmlFor="cp-categoria">
              Categoria <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="cp-categoria"
                value={idCategoria ?? ""}
                onChange={(e) => {
                  setIdCategoria(e.target.value ? Number(e.target.value) : null);
                  if (erros.idCategoria) setErros((atual) => ({ ...atual, idCategoria: "" }));
                }}
                required
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.IdCategoria} value={c.IdCategoria}>
                    {c.DescricaoCategoria}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Cadastrar nova categoria"
                aria-label="Cadastrar nova categoria"
                onClick={() => setMostrarModalCategoria(true)}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
            {erros.idCategoria && <span className="usuario-form-campo-erro">{erros.idCategoria}</span>}
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className={`usuario-form-campo conta-pagar-form-campo-valor ${erros.valorTotal ? "campo-invalido" : ""}`}>
            <label htmlFor="cp-valor-total">
              Valor Total <span className="obrigatorio">*</span>
            </label>
            <input
              id="cp-valor-total"
              value={valorTotal}
              onChange={(e) => {
                setValorTotal(formatarMoeda(e.target.value));
                if (erros.valorTotal) setErros((atual) => ({ ...atual, valorTotal: "" }));
              }}
              placeholder="R$ 0,00"
              inputMode="numeric"
              required
            />
            {erros.valorTotal && <span className="usuario-form-campo-erro">{erros.valorTotal}</span>}
          </div>

          <div className={`usuario-form-campo conta-pagar-form-campo-numero ${erros.totalParcelas ? "campo-invalido" : ""}`}>
            <label htmlFor="cp-total-parcelas">
              Total de Parcelas <span className="obrigatorio">*</span>
            </label>
            <input
              id="cp-total-parcelas"
              type="number"
              min={0}
              value={totalParcelas}
              onChange={(e) => {
                setTotalParcelas(e.target.value);
                if (erros.totalParcelas) setErros((atual) => ({ ...atual, totalParcelas: "" }));
              }}
              required
            />
            {erros.totalParcelas && <span className="usuario-form-campo-erro">{erros.totalParcelas}</span>}
          </div>

          <div className="usuario-form-campo conta-pagar-form-campo-data">
            <label htmlFor="cp-primeiro-vencimento">1º Vencimento</label>
            <input
              id="cp-primeiro-vencimento"
              type="date"
              value={primeiroVencimento}
              onChange={(e) => setPrimeiroVencimento(e.target.value)}
            />
          </div>

          <div className="usuario-form-campo conta-pagar-form-campo-numero">
            <label htmlFor="cp-intervalo-meses">Intervalo (meses)</label>
            <input
              id="cp-intervalo-meses"
              type="number"
              min={1}
              value={intervaloMeses}
              onChange={(e) => setIntervaloMeses(e.target.value)}
            />
          </div>

          <div
            className={`usuario-form-campo conta-pagar-form-campo-tipo-pagamento ${
              erros.idPrimeiroTipoPagamento ? "campo-invalido" : ""
            }`}
          >
            <label htmlFor="cp-tipo-pagamento">
              Tipo de Pagamento <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="cp-tipo-pagamento"
                value={idPrimeiroTipoPagamento ?? ""}
                onChange={(e) => {
                  setIdPrimeiroTipoPagamento(e.target.value ? Number(e.target.value) : null);
                  if (erros.idPrimeiroTipoPagamento)
                    setErros((atual) => ({ ...atual, idPrimeiroTipoPagamento: "" }));
                }}
                required
              >
                <option value="">Selecione...</option>
                {tiposPagamento.map((t) => (
                  <option key={t.idTipoPagamento} value={t.idTipoPagamento}>
                    {t.DescricaoTipoPagamento}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Cadastrar novo tipo de pagamento"
                aria-label="Cadastrar novo tipo de pagamento"
                onClick={() => setMostrarModalTipoPagamento(true)}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
            {erros.idPrimeiroTipoPagamento && (
              <span className="usuario-form-campo-erro">{erros.idPrimeiroTipoPagamento}</span>
            )}
          </div>

          {modoEdicao && saldoDevedor !== null && (
            <div className="usuario-form-campo conta-pagar-form-campo-valor">
              <label>Saldo Devedor</label>
              <input value={numeroParaMoeda(saldoDevedor)} disabled readOnly />
            </div>
          )}

          {modoEdicao && (
            <div className="usuario-form-campo conta-pagar-form-campo-recalcular">
              <label className="usuario-form-toggle">
                <input
                  type="checkbox"
                  checked={!algumaParcelaPaga && recalcularParcelas}
                  disabled={algumaParcelaPaga}
                  onChange={(e) => setRecalcularParcelas(e.target.checked)}
                />
                Recriar parcelas ao salvar
              </label>
              <span className="conta-pagar-form-dica">
                {algumaParcelaPaga
                  ? "Não é possível recriar as parcelas: já existe parcela paga."
                  : "Substitui as parcelas atuais pelas novas informadas acima."}
              </span>
            </div>
          )}
        </div>

        <div className="usuario-form-campo">
          <label htmlFor="cp-observacao">Observação</label>
          <textarea
            id="cp-observacao"
            className="conta-pagar-form-textarea"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
          />
        </div>

        {modoEdicao && parcelas.length > 0 && (
          <div className="conta-pagar-form-parcelas">
            <h3>Parcelas</h3>
            <div className="conta-pagar-form-parcelas-tabela-wrapper">
              <table className="conta-pagar-form-parcelas-tabela">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Cód. Parcela</th>
                    <th>Vencimento</th>
                    <th className="conta-pagar-col-valor">Valor</th>
                    <th className="conta-pagar-col-valor">Pago</th>
                    <th>Data Pagamento</th>
                    <th>Tipo Pagamento</th>
                    <th>Status</th>
                    {(podeBaixarParcela || podeEstornarParcela) && (
                      <th className="conta-pagar-col-acoes">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p) => {
                    const { label, classe } = statusParcelaInfo(p.IdStatusParcela);
                    const paga = parcelaPaga(p);
                    return (
                      <tr key={p.IdContaPagarParcela}>
                        <td>{pad3(p.NumeroParcela)}</td>
                        <td>{p.IdContaPagarParcela}</td>
                        <td className={classeVencimento(p.DataVencimento, paga)}>
                          {new Date(p.DataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        </td>
                        <td className="conta-pagar-col-valor">{numeroParaMoeda(p.ValorParcela)}</td>
                        <td className="conta-pagar-col-valor">{numeroParaMoeda(p.ValorPago)}</td>
                        <td>
                          {p.DataPagamento
                            ? new Date(p.DataPagamento).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                            : "-"}
                        </td>
                        <td>{p.DescricaoTipoPagamento || "-"}</td>
                        <td>
                          <span className={`conta-pagar-badge ${classe}`}>{label.toUpperCase()}</span>
                          {parcelaEstornada(p) && (
                            <span className="conta-pagar-badge-estornada" title="Parcela estornada" />
                          )}
                        </td>
                        {(podeBaixarParcela || podeEstornarParcela) && (
                          <td className="conta-pagar-col-acoes">
                            {podeBaixarParcela && !paga && (
                              <button
                                type="button"
                                className="conta-pagar-icone-acao"
                                title="Dar baixa nesta parcela"
                                aria-label="Dar baixa nesta parcela"
                                onClick={() => setParcelaEmBaixa(p)}
                              >
                                <Banknote size={16} />
                              </button>
                            )}
                            {podeEstornarParcela && paga && (
                              <button
                                type="button"
                                className="conta-pagar-icone-acao estorno"
                                title="Estornar a baixa desta parcela"
                                aria-label="Estornar a baixa desta parcela"
                                onClick={() => setParcelaEmEstorno(p)}
                              >
                                <Undo2 size={16} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {erro && <div className="usuario-form-erro">{erro}</div>}

        <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Conta a Pagar"}
          <Send size={16} />
        </button>
      </form>

      {parcelaEmBaixa && id !== null && (
        <ContaPagarBaixaModal
          idContaPagar={id}
          parcela={parcelaEmBaixa}
          onCancelar={() => setParcelaEmBaixa(null)}
          onBaixada={handleParcelaBaixada}
        />
      )}

      {parcelaEmEstorno && id !== null && (
        <ContaPagarEstornoModal
          idContaPagar={id}
          parcela={parcelaEmEstorno}
          onCancelar={() => setParcelaEmEstorno(null)}
          onEstornada={handleParcelaEstornada}
        />
      )}

      {mostrarModalFornecedor && (
        <FornecedorModal onCancelar={() => setMostrarModalFornecedor(false)} onCriado={handleFornecedorCriado} />
      )}

      {mostrarModalCategoria && (
        <CategoriaModal onCancelar={() => setMostrarModalCategoria(false)} onCriada={handleCategoriaCriada} />
      )}

      {mostrarModalTipoPagamento && (
        <TipoPagamentoModal
          onCancelar={() => setMostrarModalTipoPagamento(false)}
          onCriado={handleTipoPagamentoCriado}
        />
      )}
    </div>
  );
}

export default ContaPagarForm;
