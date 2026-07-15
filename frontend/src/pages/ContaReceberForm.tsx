import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, ExternalLink, Send, Banknote, Undo2 } from "lucide-react";
import {
  obterContaReceber,
  criarContaReceber,
  atualizarContaReceber,
  STATUS_CONTA_RECEBER,
  ParcelaContaReceber,
} from "../api/contaReceber";
import { listarClientes, Cliente } from "../api/clientes";
import { listarCategorias, Categoria } from "../api/categoria";
import { listarTiposPagamentoPadrao, TipoPagamento } from "../api/tipoPagamento";
import { focarProximoCampoAoEnter } from "../utils/form";
import { ItemMenu } from "../api/menu";
import ContaReceberBaixaModal from "./ContaReceberBaixaModal";
import ContaReceberEstornoModal from "./ContaReceberEstornoModal";
import "./UsuarioForm.css";
import "./ContaReceberForm.css";

interface ContaReceberFormProps {
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
  const item = STATUS_CONTA_RECEBER.find((s) => s.valor === idStatus);
  const classes: Record<number, string> = { 0: "pendente", 1: "pago", 2: "parcial", 3: "cancelado" };
  return { label: item?.label ?? "-", classe: classes[idStatus] ?? "pendente" };
}

function pad3(valor: number): string {
  return String(valor).padStart(3, "0");
}

function parcelaPaga(p: ParcelaContaReceber): boolean {
  return p.IdStatusParcela !== 0 || p.ValorPago > 0 || !!p.DataPagamento;
}

function ContaReceberForm({ id, onVoltar, navegarPara, permissoes }: ContaReceberFormProps) {
  const modoEdicao = id !== null;

  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [idCliente, setIdCliente] = useState<number | null>(null);
  const [nomeCliente, setNomeCliente] = useState("");
  const [idCategoria, setIdCategoria] = useState<number | null>(null);
  const [valorTotal, setValorTotal] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("1");
  const [primeiroVencimento, setPrimeiroVencimento] = useState("");
  const [idPrimeiroTipoPagamento, setIdPrimeiroTipoPagamento] = useState<number | null>(null);
  const [intervaloMeses, setIntervaloMeses] = useState("1");
  const [idStatusContaReceber, setIdStatusContaReceber] = useState(0);
  const [dataEmissao, setDataEmissao] = useState(hoje());
  const [observacao, setObservacao] = useState("");
  const [recalcularParcelas, setRecalcularParcelas] = useState(false);

  const [saldoDevedor, setSaldoDevedor] = useState<number | null>(null);
  const [parcelas, setParcelas] = useState<ParcelaContaReceber[]>([]);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([]);
  const [sugestoesCliente, setSugestoesCliente] = useState<Cliente[]>([]);
  const [mostrarSugestoesCliente, setMostrarSugestoesCliente] = useState(false);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [parcelaEmBaixa, setParcelaEmBaixa] = useState<ParcelaContaReceber | null>(null);
  const [parcelaEmEstorno, setParcelaEmEstorno] = useState<ParcelaContaReceber | null>(null);

  const algumaParcelaPaga = parcelas.some(parcelaPaga);
  const podeBaixarParcela = permissoes?.baixarParCR ?? false;
  const podeEstornarParcela = permissoes?.estornarParCR ?? false;

  useEffect(() => {
    listarCategorias().then(setCategorias);
    listarTiposPagamentoPadrao().then(setTiposPagamento);
  }, []);

  async function carregarConta() {
    if (id === null) return;
    const c = await obterContaReceber(id);
    setNumeroDocumento(c.NumeroDocumento || "");
    setDescricao(c.Descricao);
    setIdCliente(c.idCliente);
    setNomeCliente(c.NomeCliente || "");
    setIdCategoria(c.idCategoria);
    setValorTotal(numeroParaMoeda(c.ValorTotal));
    setTotalParcelas(String(c.TotalParcelas));
    setPrimeiroVencimento(paraInputDate(c.DataPrimeiraParcela));
    setIdPrimeiroTipoPagamento(c.IdPrimeiroTipoPagamento);
    setIntervaloMeses(String(c.IntervaloMeses ?? 1));
    setIdStatusContaReceber(c.IdStatusContaReceber);
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
  }

  async function handleParcelaEstornada() {
    setParcelaEmEstorno(null);
    await carregarConta();
  }

  useEffect(() => {
    if (!nomeCliente || (idCliente && nomeCliente === "")) {
      setSugestoesCliente([]);
      return;
    }
    const timeout = setTimeout(() => {
      listarClientes(nomeCliente).then(setSugestoesCliente);
    }, 250);
    return () => clearTimeout(timeout);
  }, [nomeCliente, idCliente]);

  function selecionarCliente(c: Cliente) {
    setIdCliente(c.idCliente);
    setNomeCliente(c.NomeCliente);
    setSugestoesCliente([]);
    setMostrarSugestoesCliente(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!descricao || !idCategoria || !valorTotal || !dataEmissao) {
      setErro("Informe descrição, categoria, valor total e data de emissão");
      return;
    }
    const valor = moedaParaNumero(valorTotal);
    if (valor <= 0) {
      setErro("O valor total deve ser maior que zero");
      return;
    }
    const parcelasNum = Number(totalParcelas || 0);
    if (parcelasNum < 0) {
      setErro("O total de parcelas não pode ser negativo");
      return;
    }

    const dados = {
      numeroDocumento: numeroDocumento || undefined,
      descricao,
      idCliente: idCliente ?? undefined,
      idCategoria,
      valorTotal: valor,
      totalParcelas: parcelasNum,
      primeiroVencimento: primeiroVencimento || undefined,
      idPrimeiroTipoPagamento: idPrimeiroTipoPagamento ?? undefined,
      intervaloMeses: intervaloMeses ? Number(intervaloMeses) : undefined,
      idStatusContaReceber,
      dataEmissao,
      observacao: observacao || undefined,
    };

    setSalvando(true);
    try {
      if (modoEdicao && id !== null) {
        await atualizarContaReceber(id, {
          ...dados,
          recalcularParcelas: algumaParcelaPaga ? false : recalcularParcelas,
        });
      } else {
        await criarContaReceber(dados);
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar a conta a receber");
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
        <h2>{modoEdicao ? "Editar Conta a Receber" : "Nova Conta a Receber"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form">
        <div className="usuario-form-linha">
          <div className="usuario-form-campo conta-receber-form-campo-documento">
            <label htmlFor="cr-numero-documento">Nº Documento</label>
            <input
              id="cr-numero-documento"
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Nº do documento"
              maxLength={50}
            />
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-data">
            <label htmlFor="cr-data-emissao">
              Data de Emissão <span className="obrigatorio">*</span>
            </label>
            <input
              id="cr-data-emissao"
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
              required
            />
          </div>

          <div className="usuario-form-campo">
            <label htmlFor="cr-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="cr-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Digite a descrição"
              maxLength={255}
              required
            />
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-status">
            <label htmlFor="cr-status">Status</label>
            <input
              id="cr-status"
              className={`conta-receber-form-status-select ${statusParcelaInfo(idStatusContaReceber).classe}`}
              value={statusParcelaInfo(idStatusContaReceber).label}
              disabled
              readOnly
              title="Definido automaticamente pelo sistema, conforme a situação das parcelas"
            />
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo usuario-form-combobox">
            <label htmlFor="cr-cliente">Cliente</label>
            <div className="usuario-form-campo-com-acao">
              <input
                id="cr-cliente"
                value={nomeCliente}
                onChange={(e) => {
                  setNomeCliente(e.target.value);
                  setIdCliente(null);
                  setMostrarSugestoesCliente(true);
                }}
                onFocus={() => setMostrarSugestoesCliente(true)}
                onBlur={() => setTimeout(() => setMostrarSugestoesCliente(false), 150)}
                placeholder="Digite para buscar o cliente..."
                autoComplete="off"
              />
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Ir para Cadastro de Clientes"
                onClick={() => navegarPara?.("clientes", "Cadastro de Clientes", "Cadastros")}
              >
                <ExternalLink size={16} />
              </button>
            </div>
            {mostrarSugestoesCliente && sugestoesCliente.length > 0 && (
              <ul className="usuario-form-sugestoes">
                {sugestoesCliente.map((c) => (
                  <li key={c.idCliente} onMouseDown={() => selecionarCliente(c)}>
                    {c.NomeCliente}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-categoria-larga">
            <label htmlFor="cr-categoria">
              Categoria <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="cr-categoria"
                value={idCategoria ?? ""}
                onChange={(e) => setIdCategoria(e.target.value ? Number(e.target.value) : null)}
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
                title="Ir para Cadastro de Categorias"
                onClick={() => navegarPara?.("categoria", "Cadastro de Categorias", "Cadastros")}
              >
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className="usuario-form-campo conta-receber-form-campo-valor">
            <label htmlFor="cr-valor-total">
              Valor Total <span className="obrigatorio">*</span>
            </label>
            <input
              id="cr-valor-total"
              value={valorTotal}
              onChange={(e) => setValorTotal(formatarMoeda(e.target.value))}
              placeholder="R$ 0,00"
              inputMode="numeric"
              required
            />
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-numero">
            <label htmlFor="cr-total-parcelas">
              Total de Parcelas <span className="obrigatorio">*</span>
            </label>
            <input
              id="cr-total-parcelas"
              type="number"
              min={0}
              value={totalParcelas}
              onChange={(e) => setTotalParcelas(e.target.value)}
              required
            />
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-data">
            <label htmlFor="cr-primeiro-vencimento">1º Vencimento</label>
            <input
              id="cr-primeiro-vencimento"
              type="date"
              value={primeiroVencimento}
              onChange={(e) => setPrimeiroVencimento(e.target.value)}
            />
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-numero">
            <label htmlFor="cr-intervalo-meses">Intervalo (meses)</label>
            <input
              id="cr-intervalo-meses"
              type="number"
              min={1}
              value={intervaloMeses}
              onChange={(e) => setIntervaloMeses(e.target.value)}
            />
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-tipo-pagamento">
            <label htmlFor="cr-tipo-pagamento">Tipo de Pagamento</label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="cr-tipo-pagamento"
                value={idPrimeiroTipoPagamento ?? ""}
                onChange={(e) => setIdPrimeiroTipoPagamento(e.target.value ? Number(e.target.value) : null)}
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
                title="Ir para Cadastro de Tipos de Pagamento"
                onClick={() => navegarPara?.("tipo-pagamento", "Cadastro de Tipos de Pagamento", "Cadastros")}
              >
                <ExternalLink size={16} />
              </button>
            </div>
          </div>

          {modoEdicao && saldoDevedor !== null && (
            <div className="usuario-form-campo conta-receber-form-campo-valor">
              <label>Saldo Devedor</label>
              <input value={numeroParaMoeda(saldoDevedor)} disabled readOnly />
            </div>
          )}

          {modoEdicao && (
            <div className="usuario-form-campo conta-receber-form-campo-recalcular">
              <label className="usuario-form-toggle">
                <input
                  type="checkbox"
                  checked={!algumaParcelaPaga && recalcularParcelas}
                  disabled={algumaParcelaPaga}
                  onChange={(e) => setRecalcularParcelas(e.target.checked)}
                />
                Recriar parcelas ao salvar
              </label>
              <span className="conta-receber-form-dica">
                {algumaParcelaPaga
                  ? "Não é possível recriar as parcelas: já existe parcela paga."
                  : "Substitui as parcelas atuais pelas novas informadas acima."}
              </span>
            </div>
          )}
        </div>

        <div className="usuario-form-campo">
          <label htmlFor="cr-observacao">Observação</label>
          <textarea
            id="cr-observacao"
            className="conta-receber-form-textarea"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
          />
        </div>

        {modoEdicao && parcelas.length > 0 && (
          <div className="conta-receber-form-parcelas">
            <h3>Parcelas</h3>
            <div className="conta-receber-form-parcelas-tabela-wrapper">
              <table className="conta-receber-form-parcelas-tabela">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Vencimento</th>
                    <th className="conta-receber-col-valor">Valor</th>
                    <th className="conta-receber-col-valor">Pago</th>
                    <th>Data Pagamento</th>
                    <th>Tipo Pagamento</th>
                    <th>Status</th>
                    {(podeBaixarParcela || podeEstornarParcela) && (
                      <th className="conta-receber-col-acoes">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p) => {
                    const { label, classe } = statusParcelaInfo(p.IdStatusParcela);
                    const paga = parcelaPaga(p);
                    return (
                      <tr key={p.IdContaReceberParcela}>
                        <td>{pad3(p.NumeroParcela)}</td>
                        <td>{new Date(p.DataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                        <td className="conta-receber-col-valor">{numeroParaMoeda(p.ValorParcela)}</td>
                        <td className="conta-receber-col-valor">{numeroParaMoeda(p.ValorPago)}</td>
                        <td>
                          {p.DataPagamento
                            ? new Date(p.DataPagamento).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                            : "-"}
                        </td>
                        <td>{p.DescricaoTipoPagamento || "-"}</td>
                        <td>
                          <span className={`conta-receber-badge ${classe}`}>{label.toUpperCase()}</span>
                        </td>
                        {(podeBaixarParcela || podeEstornarParcela) && (
                          <td className="conta-receber-col-acoes">
                            {podeBaixarParcela && !paga && (
                              <button
                                type="button"
                                className="conta-receber-icone-acao"
                                title="Dar baixa nesta parcela"
                                onClick={() => setParcelaEmBaixa(p)}
                              >
                                <Banknote size={16} />
                              </button>
                            )}
                            {podeEstornarParcela && paga && (
                              <button
                                type="button"
                                className="conta-receber-icone-acao estorno"
                                title="Estornar a baixa desta parcela"
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
          {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Criar Conta a Receber"}
          <Send size={16} />
        </button>
      </form>

      {parcelaEmBaixa && id !== null && (
        <ContaReceberBaixaModal
          idContaReceber={id}
          parcela={parcelaEmBaixa}
          onCancelar={() => setParcelaEmBaixa(null)}
          onBaixada={handleParcelaBaixada}
        />
      )}

      {parcelaEmEstorno && id !== null && (
        <ContaReceberEstornoModal
          idContaReceber={id}
          parcela={parcelaEmEstorno}
          onCancelar={() => setParcelaEmEstorno(null)}
          onEstornada={handleParcelaEstornada}
        />
      )}
    </div>
  );
}

export default ContaReceberForm;
