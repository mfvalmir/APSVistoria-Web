import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, MoreHorizontal, Send, Banknote, Undo2, Eye } from "lucide-react";
import {
  obterContaReceber,
  criarContaReceber,
  atualizarContaReceber,
  STATUS_CONTA_RECEBER,
  ParcelaContaReceber,
} from "../api/contaReceber";
import { listarClientes, obterCliente, Cliente } from "../api/clientes";
import { listarCategorias, Categoria } from "../api/categoria";
import { listarTiposPagamentoPadrao, TipoPagamento } from "../api/tipoPagamento";
import { focarProximoCampoAoEnter } from "../utils/form";
import { visualizarRecibo } from "../utils/recibo";
import { ItemMenu } from "../api/menu";
import ContaReceberBaixaModal from "./ContaReceberBaixaModal";
import ContaReceberEstornoModal from "./ContaReceberEstornoModal";
import ClienteModal from "./ClienteModal";
import CategoriaModal from "./CategoriaModal";
import TipoPagamentoModal from "./TipoPagamentoModal";
import { useToast } from "../contexts/ToastContext";
import { useConfirmacao } from "../contexts/ConfirmContext";
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

function classeVencimento(dataVencimento: string, paga: boolean): string {
  if (paga) return "";
  const venc = dataVencimento.slice(0, 10);
  const hojeStr = new Date().toISOString().slice(0, 10);
  if (venc < hojeStr) return "conta-receber-vencimento-vencida";
  if (venc === hojeStr) return "conta-receber-vencimento-hoje";
  return "";
}

function parcelaEstornada(p: ParcelaContaReceber): boolean {
  return !!p.Observacao?.startsWith("[Estorno");
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
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [mostrarModalCategoria, setMostrarModalCategoria] = useState(false);
  const [mostrarModalTipoPagamento, setMostrarModalTipoPagamento] = useState(false);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  const [parcelaEmBaixa, setParcelaEmBaixa] = useState<ParcelaContaReceber | null>(null);
  const [parcelaEmEstorno, setParcelaEmEstorno] = useState<ParcelaContaReceber | null>(null);
  const [gerandoRecibo, setGerandoRecibo] = useState<number | null>(null);

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
    mostrarToast("Parcela baixada com sucesso", "sucesso");
  }

  async function handleParcelaEstornada() {
    setParcelaEmEstorno(null);
    await carregarConta();
    mostrarToast("Baixa estornada com sucesso", "sucesso");
  }

  async function emitirRecibo(p: ParcelaContaReceber) {
    if (id === null) return;
    setGerandoRecibo(p.IdContaReceberParcela);
    try {
      let documentoPagador: string | null = null;
      if (idCliente) {
        try {
          const cliente = await obterCliente(idCliente);
          documentoPagador = cliente.CpfCnpj || null;
        } catch {
          documentoPagador = null;
        }
      }
      await visualizarRecibo({
        numeroRecibo: `${id}-${pad3(p.NumeroParcela)}`,
        nomePagador: nomeCliente.trim() || "Cliente não identificado",
        documentoPagador,
        valor: p.ValorPago || p.ValorParcela,
        dataPagamento: p.DataPagamento || hoje(),
        formaPagamento: p.DescricaoTipoPagamento || "-",
        referente: `à parcela nº ${pad3(p.NumeroParcela)}/${pad3(parcelas.length)} da Conta a Receber nº ${id}${
          descricao ? ` (${descricao})` : ""
        }`,
        observacao: p.Observacao,
      });
    } catch {
      mostrarToast("Não foi possível gerar o recibo", "erro");
    } finally {
      setGerandoRecibo(null);
    }
  }

  // Quando a emissão coincide com o 1º vencimento (venda à vista), a procedure já baixa a
  // parcela automaticamente na criação - sem isso, o recibo só ficaria acessível voltando pra
  // lista e expandindo a linha. Aqui a gente detecta esse caso e já oferece o recibo na hora.
  async function perguntarEVisualizarReciboAVista(idNovaConta: number) {
    const contaCriada = await obterContaReceber(idNovaConta);
    const parcelaAVista = contaCriada.parcelas.find(parcelaPaga);
    if (!parcelaAVista) return;

    const verRecibo = await confirmar({
      titulo: "Pagamento à vista",
      mensagem: "Essa parcela já nasceu paga (pagamento à vista). Deseja visualizar o recibo agora?",
      textoConfirmar: "Ver recibo",
      textoCancelar: "Agora não",
    });
    if (!verRecibo) return;

    let documentoPagador: string | null = null;
    if (contaCriada.idCliente) {
      try {
        const cliente = await obterCliente(contaCriada.idCliente);
        documentoPagador = cliente.CpfCnpj || null;
      } catch {
        documentoPagador = null;
      }
    }
    try {
      await visualizarRecibo({
        numeroRecibo: `${contaCriada.IdContaReceber}-${pad3(parcelaAVista.NumeroParcela)}`,
        nomePagador: contaCriada.NomeCliente?.trim() || "Cliente não identificado",
        documentoPagador,
        valor: parcelaAVista.ValorPago || parcelaAVista.ValorParcela,
        dataPagamento: parcelaAVista.DataPagamento || hoje(),
        formaPagamento: parcelaAVista.DescricaoTipoPagamento || "-",
        referente: `à parcela nº ${pad3(parcelaAVista.NumeroParcela)}/${pad3(
          contaCriada.parcelas.length
        )} da Conta a Receber nº ${contaCriada.IdContaReceber}${
          contaCriada.Descricao ? ` (${contaCriada.Descricao})` : ""
        }`,
        observacao: parcelaAVista.Observacao,
      });
    } catch {
      mostrarToast("Não foi possível gerar o recibo", "erro");
    }
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

  function handleClienteCriado(c: Cliente) {
    selecionarCliente(c);
    setMostrarModalCliente(false);
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
        mostrarToast("Conta a receber atualizada com sucesso", "sucesso");
      } else {
        const { idContaReceber } = await criarContaReceber(dados);
        mostrarToast("Conta a receber criada com sucesso", "sucesso");
        await perguntarEVisualizarReciboAVista(idContaReceber);
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

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
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

          <div className={`usuario-form-campo conta-receber-form-campo-data ${erros.dataEmissao ? "campo-invalido" : ""}`}>
            <label htmlFor="cr-data-emissao">
              Data de Emissão <span className="obrigatorio">*</span>
            </label>
            <input
              id="cr-data-emissao"
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
            <label htmlFor="cr-descricao">
              Descrição <span className="obrigatorio">*</span>
            </label>
            <input
              id="cr-descricao"
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
                title="Cadastrar novo cliente"
                aria-label="Cadastrar novo cliente"
                onClick={() => setMostrarModalCliente(true)}
              >
                <MoreHorizontal size={16} />
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

          <div className={`usuario-form-campo conta-receber-form-campo-categoria-larga ${erros.idCategoria ? "campo-invalido" : ""}`}>
            <label htmlFor="cr-categoria">
              Categoria <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="cr-categoria"
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
          <div className={`usuario-form-campo conta-receber-form-campo-valor ${erros.valorTotal ? "campo-invalido" : ""}`}>
            <label htmlFor="cr-valor-total">
              Valor Total <span className="obrigatorio">*</span>
            </label>
            <input
              id="cr-valor-total"
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

          <div className={`usuario-form-campo conta-receber-form-campo-numero ${erros.totalParcelas ? "campo-invalido" : ""}`}>
            <label htmlFor="cr-total-parcelas">
              Total de Parcelas <span className="obrigatorio">*</span>
            </label>
            <input
              id="cr-total-parcelas"
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

          <div
            className={`usuario-form-campo conta-receber-form-campo-tipo-pagamento ${
              erros.idPrimeiroTipoPagamento ? "campo-invalido" : ""
            }`}
          >
            <label htmlFor="cr-tipo-pagamento">
              Tipo de Pagamento <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="cr-tipo-pagamento"
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
                    <th>Cód. Parcela</th>
                    <th>Vencimento</th>
                    <th className="conta-receber-col-valor">Valor</th>
                    <th className="conta-receber-col-valor">Pago</th>
                    <th>Data Pagamento</th>
                    <th>Tipo Pagamento</th>
                    <th>Status</th>
                    {(podeBaixarParcela || podeEstornarParcela || algumaParcelaPaga) && (
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
                        <td>{p.IdContaReceberParcela}</td>
                        <td className={classeVencimento(p.DataVencimento, paga)}>
                          {new Date(p.DataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        </td>
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
                          {parcelaEstornada(p) && (
                            <span className="conta-receber-badge-estornada" title="Parcela estornada" />
                          )}
                        </td>
                        {(podeBaixarParcela || podeEstornarParcela || algumaParcelaPaga) && (
                          <td className="conta-receber-col-acoes">
                            {podeBaixarParcela && !paga && (
                              <button
                                type="button"
                                className="conta-receber-icone-acao"
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
                                className="conta-receber-icone-acao estorno"
                                title="Estornar a baixa desta parcela"
                                aria-label="Estornar a baixa desta parcela"
                                onClick={() => setParcelaEmEstorno(p)}
                              >
                                <Undo2 size={16} />
                              </button>
                            )}
                            {paga && (
                              <button
                                type="button"
                                className="conta-receber-icone-acao"
                                title="Visualizar recibo"
                                aria-label="Visualizar recibo"
                                disabled={gerandoRecibo === p.IdContaReceberParcela}
                                onClick={() => emitirRecibo(p)}
                              >
                                <Eye size={16} />
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

      {mostrarModalCliente && (
        <ClienteModal onCancelar={() => setMostrarModalCliente(false)} onCriado={handleClienteCriado} />
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

export default ContaReceberForm;
