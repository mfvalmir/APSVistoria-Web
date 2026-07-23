import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, MoreHorizontal, Send, Banknote, Undo2, Eye } from "lucide-react";
import { obterVistoria, criarVistoria, atualizarVistoria, STATUS_VISTORIA } from "../api/vistoria";
import { ParcelaContaReceber } from "../api/contaReceber";
import { listarClientes, criarCliente, Cliente } from "../api/clientes";
import { listarResponsaveis, criarResponsavel, Responsavel } from "../api/responsaveis";
import { buscarFuncionarios, FuncionarioResumo } from "../api/funcionarios";
import { listarServicos, Servico } from "../api/servico";
import { listarTiposPagamento, TipoPagamento, ehTipoRetornoOuCortesia } from "../api/tipoPagamento";
import { validarCPF, validarCNPJ } from "../utils/documento";
import { focarProximoCampoAoEnter } from "../utils/form";
import { visualizarRecibo, ReciboValorZeroError } from "../utils/recibo";
import { ItemMenu } from "../api/menu";
import ContaReceberBaixaModal from "./ContaReceberBaixaModal";
import ContaReceberEstornoModal from "./ContaReceberEstornoModal";
import ClienteModal from "./ClienteModal";
import FuncionarioModal from "./FuncionarioModal";
import ServicoModal from "./ServicoModal";
import TipoPagamentoModal from "./TipoPagamentoModal";
import ResponsavelModal from "./ResponsavelModal";
import { useToast } from "../contexts/ToastContext";
import { useConfirmacao } from "../contexts/ConfirmContext";
import "./UsuarioForm.css";
import "./ContaReceberForm.css";
import "./VistoriaForm.css";

interface VistoriaFormProps {
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

// Cpf/Cnpj do form de Vistoria não tem seletor de Tipo Pessoa (igual a Fornecedor) - o tipo
// de documento é inferido pela quantidade de dígitos digitados.
function formatarDocumento(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  return digitos.length > 11 ? formatarCNPJ(valor) : formatarCPF(valor);
}

function documentoValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 11) return validarCPF(digitos);
  if (digitos.length === 14) return validarCNPJ(digitos);
  return false;
}

function statusVistoriaInfo(idStatus: number): { label: string; classe: string } {
  const item = STATUS_VISTORIA.find((s) => s.valor === idStatus);
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

interface ParcelaPreview {
  numero: number;
  vencimento: string;
  valor: number;
}

// Mesma regra de arredondamento da procedure Manter_Vistoria: a 1ª parcela absorve a
// diferença; vencimentos mensais a partir do 1º Vencimento. Só para prévia visual antes de
// salvar - o cronograma real é calculado pelo banco.
function calcularParcelasPreview(valorTotal: number, totalParcelas: number, primeiraData: string): ParcelaPreview[] {
  const n = Math.max(1, Math.floor(totalParcelas || 1));
  if (!valorTotal || valorTotal <= 0) return [];

  const valorParcela = Math.round((valorTotal / n) * 100) / 100;
  const valorPrimeira = Math.round((valorTotal - valorParcela * (n - 1)) * 100) / 100;
  const base = primeiraData ? new Date(`${primeiraData}T00:00:00`) : new Date();

  return Array.from({ length: n }, (_, i) => {
    const venc = new Date(base);
    venc.setMonth(venc.getMonth() + i);
    return { numero: i + 1, vencimento: venc.toISOString().slice(0, 10), valor: i === 0 ? valorPrimeira : valorParcela };
  });
}

function VistoriaForm({ id, onVoltar, navegarPara, permissoes }: VistoriaFormProps) {
  const modoEdicao = id !== null;

  const [dataEmissao, setDataEmissao] = useState(hoje());
  const [placaVeiculo, setPlacaVeiculo] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null);
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [sugestoesClientePorNomeCliente, setSugestoesClientePorNomeCliente] = useState<Cliente[]>([]);
  const [mostrarSugestoesCliente, setMostrarSugestoesCliente] = useState(false);

  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [idResponsavel, setIdResponsavel] = useState<number | null>(null);
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState<Responsavel[]>([]);
  const [sugestoesClientePorNome, setSugestoesClientePorNome] = useState<Cliente[]>([]);
  const [mostrarSugestoesResponsavel, setMostrarSugestoesResponsavel] = useState(false);
  const [mostrarModalResponsavel, setMostrarModalResponsavel] = useState(false);

  const [idVistoriador, setIdVistoriador] = useState<number | null>(null);
  const [vistoriadores, setVistoriadores] = useState<FuncionarioResumo[]>([]);
  const [mostrarModalVistoriador, setMostrarModalVistoriador] = useState(false);

  const [idServico, setIdServico] = useState<number | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [valorUnitarioServico, setValorUnitarioServico] = useState("");
  const [quantidadeServico, setQuantidadeServico] = useState("1");
  const [mostrarModalServico, setMostrarModalServico] = useState(false);

  const [totalParcelas, setTotalParcelas] = useState("1");
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(hoje());
  const [idPrimeiroTipoPagamento, setIdPrimeiroTipoPagamento] = useState<number | null>(null);
  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([]);
  const [mostrarModalTipoPagamento, setMostrarModalTipoPagamento] = useState(false);

  const [idStatusVistoria, setIdStatusVistoria] = useState(0);
  const [saldoDevedor, setSaldoDevedor] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  const [parcelas, setParcelas] = useState<ParcelaContaReceber[]>([]);
  const [idContaReceber, setIdContaReceber] = useState<number | null>(null);

  const [responsavelEmissao, setResponsavelEmissao] = useState("");
  const [usuarioAlteracao, setUsuarioAlteracao] = useState("");
  const [dataAlteracao, setDataAlteracao] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  const [parcelaEmBaixa, setParcelaEmBaixa] = useState<ParcelaContaReceber | null>(null);
  const [parcelaEmEstorno, setParcelaEmEstorno] = useState<ParcelaContaReceber | null>(null);
  const [gerandoRecibo, setGerandoRecibo] = useState<number | null>(null);
  const [gerandoReciboAVista, setGerandoReciboAVista] = useState(false);

  const algumaParcelaPaga = parcelas.some(parcelaPaga);
  const podeBaixarParcela = permissoes?.baixarParCR ?? false;
  const podeEstornarParcela = permissoes?.estornarParCR ?? false;

  const valorTotalServico = moedaParaNumero(valorUnitarioServico) * (Number(quantidadeServico) || 0);

  // Retorno/Cortesia só fazem sentido quando não há cobrança real (valor 0) - com valor maior
  // que zero, esses dois tipos ficam de fora e só as formas de pagamento normais aparecem.
  const tiposPagamentoDisponiveis = tiposPagamento.filter((t) =>
    valorTotalServico === 0 ? ehTipoRetornoOuCortesia(t.DescricaoTipoPagamento) : !ehTipoRetornoOuCortesia(t.DescricaoTipoPagamento)
  );

  // O banco tem um trigger (TR_Vistoria_TravarCampos_QuandoPagoOuParcial) que bloqueia
  // qualquer alteração de cabeçalho - e também exclusão - quando a vistoria já está Paga ou
  // Parcial (só status/auditoria podem mudar, via sincronização automática da baixa/estorno
  // de parcela). Por isso o form trava por completo nesses status, não só os campos
  // financeiros.
  const formTotalmenteTravado = modoEdicao && (idStatusVistoria === 1 || idStatusVistoria === 2);

  // Vistoria.SaldoDevedor só é gravado na criação e não é atualizado por baixa/estorno de
  // parcela (só ContaReceber.SaldoDevedor é sincronizado) - por isso o saldo exibido aqui é
  // calculado a partir das parcelas reais, não do campo (potencialmente desatualizado).
  const saldoDevedorAtual = parcelas.length > 0 ? parcelas.reduce((soma, p) => soma + (p.ValorParcela - p.ValorPago), 0) : saldoDevedor;

  useEffect(() => {
    listarServicos(undefined, "A").then(setServicos);
    listarTiposPagamento().then(setTiposPagamento);
    buscarFuncionarios("", { somenteVistoriador: true }).then(setVistoriadores);
  }, []);

  // Se o valor passar de zero pra positivo (ou vice-versa) e o tipo de pagamento já escolhido
  // não fizer mais parte da lista filtrada (ex.: tinha "Dinheiro" selecionado e o valor foi
  // zerado), limpa a seleção em vez de deixar um valor inválido escondido no select. Só se
  // aplica na criação - em edição o campo já vem travado.
  useEffect(() => {
    if (modoEdicao || idPrimeiroTipoPagamento === null || tiposPagamento.length === 0) return;
    const aindaValido = tiposPagamentoDisponiveis.some((t) => t.idTipoPagamento === idPrimeiroTipoPagamento);
    if (!aindaValido) setIdPrimeiroTipoPagamento(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorTotalServico, tiposPagamento]);

  async function carregarVistoria() {
    if (id === null) return;
    const v = await obterVistoria(id);
    setDataEmissao(paraInputDate(v.DataEmissao));
    setPlacaVeiculo(v.PlacaVeiculo);
    setCpfCnpj(v.CpfCnpj ? formatarDocumento(v.CpfCnpj) : "");
    setNomeCliente(v.NomeCliente || "");
    setNomeResponsavel(v.NomeResponsavel || "");
    setIdResponsavel(v.idResponsavel);
    setIdVistoriador(v.idVistoriador);
    setIdServico(v.idServico);
    setValorUnitarioServico(numeroParaMoeda(v.ValorUnitarioServico));
    setQuantidadeServico(String(v.QuantidadeServico));
    setTotalParcelas(String(v.TotalParcelas));
    setDataPrimeiraParcela(paraInputDate(v.DataPrimeiraParcela));
    setIdPrimeiroTipoPagamento(v.idPrimeiroTipoPagamento);
    setIdStatusVistoria(v.idStatusVistoria);
    setSaldoDevedor(v.SaldoDevedor);
    setObservacao(v.Observacao || "");
    setParcelas(v.parcelas);
    setIdContaReceber(v.idContaReceber);
    setResponsavelEmissao(v.idUsuarioEmissao ? String(v.idUsuarioEmissao) : "");
    setUsuarioAlteracao(v.idUsuarioAlteracao ? String(v.idUsuarioAlteracao) : "");
    setDataAlteracao(v.DataAlteracao);
  }

  useEffect(() => {
    if (!modoEdicao || id === null) return;
    carregarVistoria().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, modoEdicao]);

  // Busca (com debounce) o Cliente já cadastrado com esse Cpf/Cnpj, pra reaproveitar em vez
  // de criar um duplicado ao salvar - e pra alimentar as sugestões de Responsável.
  useEffect(() => {
    const digitos = cpfCnpj.replace(/\D/g, "");
    if (digitos.length !== 11 && digitos.length !== 14) {
      setClienteEncontrado(null);
      return;
    }
    const timeout = setTimeout(async () => {
      const encontrados = await listarClientes(digitos);
      const match = encontrados.find((c) => c.CpfCnpj.replace(/\D/g, "") === digitos) || null;
      setClienteEncontrado(match);
      if (match) setNomeCliente(match.NomeCliente);
    }, 300);
    return () => clearTimeout(timeout);
  }, [cpfCnpj]);

  // Ao encontrar um cliente já cadastrado, além de alimentar as sugestões, já preenche o
  // responsável automaticamente (se houver e o campo ainda estiver vazio) - evita ter que abrir
  // o dropdown e escolher manualmente o mesmo responsável de sempre.
  useEffect(() => {
    if (!clienteEncontrado) {
      setSugestoesResponsavel([]);
      return;
    }
    listarResponsaveis(clienteEncontrado.idCliente).then((responsaveis) => {
      setSugestoesResponsavel(responsaveis);
      setIdResponsavel((atual) => {
        if (atual && responsaveis.some((r) => r.idResponsavel === atual)) return atual;
        return responsaveis[0]?.idResponsavel ?? null;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteEncontrado]);

  // Enquanto o cliente ainda não foi localizado pelo Cpf/Cnpj, o campo Responsável também busca
  // Clientes pelo nome digitado - se o atendente já souber o nome do cliente (mesmo sem o
  // documento em mãos), selecionar um resultado já preenche o resto dos dados. Se não selecionar
  // nada, o texto digitado segue normalmente como nome do responsável.
  useEffect(() => {
    if (clienteEncontrado || nomeResponsavel.trim().length < 2) {
      setSugestoesClientePorNome([]);
      return;
    }
    const timeout = setTimeout(() => {
      listarClientes(nomeResponsavel).then(setSugestoesClientePorNome);
    }, 300);
    return () => clearTimeout(timeout);
  }, [nomeResponsavel, clienteEncontrado]);

  // Mesma ideia, mas buscando direto pelo nome digitado no próprio campo Cliente - útil quando o
  // atendente nem chegou a digitar o Cpf/Cnpj ainda.
  useEffect(() => {
    if (clienteEncontrado || nomeCliente.trim().length < 2) {
      setSugestoesClientePorNomeCliente([]);
      return;
    }
    const timeout = setTimeout(() => {
      listarClientes(nomeCliente).then(setSugestoesClientePorNomeCliente);
    }, 300);
    return () => clearTimeout(timeout);
  }, [nomeCliente, clienteEncontrado]);

  function selecionarCliente(c: Cliente) {
    setCpfCnpj(formatarDocumento(c.CpfCnpj));
    setNomeCliente(c.NomeCliente);
    setClienteEncontrado(c);
    setNomeResponsavel("");
    setSugestoesClientePorNome([]);
    setSugestoesClientePorNomeCliente([]);
    setMostrarSugestoesResponsavel(false);
    setMostrarSugestoesCliente(false);
  }

  function handleClienteCriado(c: Cliente) {
    setCpfCnpj(formatarDocumento(c.CpfCnpj));
    setNomeCliente(c.NomeCliente);
    setClienteEncontrado(c);
    setMostrarModalCliente(false);
  }

  function selecionarServico(idSelecionado: number | null) {
    setIdServico(idSelecionado);
    const servico = servicos.find((s) => s.idServico === idSelecionado);
    if (servico) setValorUnitarioServico(numeroParaMoeda(servico.ValorServico));
  }

  function handleVistoriadorCriado(f: FuncionarioResumo) {
    setVistoriadores((atual) => [...atual, f].sort((a, b) => a.NomeFuncionario.localeCompare(b.NomeFuncionario)));
    setIdVistoriador(f.IdFuncionario);
    setMostrarModalVistoriador(false);
  }

  function handleServicoCriado(s: Servico) {
    setServicos((atual) => [...atual, s].sort((a, b) => a.DescricaoServico.localeCompare(b.DescricaoServico)));
    selecionarServico(s.idServico);
    setMostrarModalServico(false);
  }

  function handleTipoPagamentoCriado(t: TipoPagamento) {
    setTiposPagamento((atual) =>
      [...atual, t].sort((a, b) => a.DescricaoTipoPagamento.localeCompare(b.DescricaoTipoPagamento))
    );
    setIdPrimeiroTipoPagamento(t.idTipoPagamento);
    setMostrarModalTipoPagamento(false);
  }

  function handleResponsavelCriado(r: Responsavel) {
    setSugestoesResponsavel((atual) => [...atual, r]);
    setIdResponsavel(r.idResponsavel);
    setMostrarModalResponsavel(false);
  }

  // Resolve (ou cria) o Cliente pelo Cpf/Cnpj digitado, e o Responsável (vinculado a esse
  // Cliente) - fluxo pensado pro atendimento de vistoria, onde o cliente muitas vezes ainda não
  // está cadastrado. Quando o cliente já foi resolvido (encontrado pelo Cpf/Cnpj ou cadastrado
  // pelo modal), o responsável já vem escolhido no dropdown, sem precisar resolver por nome.
  async function resolverClienteEResponsavel(): Promise<{ idCliente: number; idResponsavel?: number }> {
    if (clienteEncontrado) {
      return { idCliente: clienteEncontrado.idCliente, idResponsavel: idResponsavel ?? undefined };
    }

    const digitos = cpfCnpj.replace(/\D/g, "");
    const tipoPessoa: "F" | "J" = digitos.length > 11 ? "J" : "F";

    let idCliente: number;
    const encontrados = await listarClientes(digitos);
    const match = encontrados.find((c) => c.CpfCnpj.replace(/\D/g, "") === digitos);
    if (match) {
      idCliente = match.idCliente;
    } else {
      idCliente = await criarCliente({
        nomeCliente: nomeCliente.trim() || formatarDocumento(digitos),
        tipoPessoa,
        cpfCnpj: digitos,
      });
    }

    const nomeResp = nomeResponsavel.trim();
    if (!nomeResp) return { idCliente };

    const responsaveis = await listarResponsaveis(idCliente);
    const matchResp = responsaveis.find((r) => r.NomeResponsavel.trim().toLowerCase() === nomeResp.toLowerCase());
    if (matchResp) return { idCliente, idResponsavel: matchResp.idResponsavel };

    const { idResponsavel: novoId } = await criarResponsavel(idCliente, { nomeResponsavel: nomeResp });
    return { idCliente, idResponsavel: novoId };
  }

  async function handleParcelaBaixada() {
    setParcelaEmBaixa(null);
    await carregarVistoria();
    mostrarToast("Parcela baixada com sucesso", "sucesso");
  }

  async function handleParcelaEstornada() {
    setParcelaEmEstorno(null);
    await carregarVistoria();
    mostrarToast("Baixa estornada com sucesso", "sucesso");
  }

  async function emitirRecibo(p: ParcelaContaReceber) {
    if (id === null) return;
    setGerandoRecibo(p.IdContaReceberParcela);
    try {
      const nomeServico = servicos.find((s) => s.idServico === idServico)?.DescricaoServico || "-";
      await visualizarRecibo({
        numeroRecibo: `${id}-${pad3(p.NumeroParcela)}`,
        nomePagador: nomeCliente.trim() || "Cliente não identificado",
        documentoPagador: cpfCnpj || null,
        valor: p.ValorPago || p.ValorParcela,
        dataPagamento: p.DataPagamento || hoje(),
        formaPagamento: p.DescricaoTipoPagamento || "-",
        referente: `à parcela nº ${pad3(p.NumeroParcela)}/${pad3(parcelas.length)} da Vistoria nº ${id} - Veículo placa ${placaVeiculo} - Serviço: ${nomeServico}`,
        observacao: p.Observacao,
      });
    } catch (err) {
      if (err instanceof ReciboValorZeroError) {
        await confirmar({ titulo: "Recibo não gerado", mensagem: err.message, apenasOk: true });
      } else {
        mostrarToast("Não foi possível gerar o recibo", "erro");
      }
    } finally {
      setGerandoRecibo(null);
    }
  }

  // A 1ª parcela de uma Vistoria à vista nunca vira uma linha em ContaReceberParcela - a
  // procedure Manter_Vistoria trata esse pagamento só via CaixaMovimento, ligado direto na
  // Vistoria (idContaReceber só é gravado a partir da 2ª parcela em diante, se houver). Por
  // isso o recibo desse pagamento é montado a partir do próprio cabeçalho da Vistoria
  // (idStatusVistoria 1=Pago ou 2=Parcial indica que a 1ª parcela nasceu paga), não de uma
  // parcela específica.
  function dadosReciboAVista(v: {
    idVistoria: number;
    NomeCliente: string | null;
    CpfCnpj: string | null;
    ValorTotalServico: number;
    SaldoDevedor: number | null;
    DataEmissao: string;
    DescricaoTipoPagamento: string | null;
    PlacaVeiculo: string;
    DescricaoServico: string | null;
    Observacao: string | null;
    TotalParcelas: number;
  }) {
    // Com mais de 1 parcela, o que nasce pago é só a entrada - o restante ainda está em aberto
    // nas parcelas seguintes. Com 1 parcela só, o pagamento é o valor à vista, total mesmo.
    const tipoPagamento = v.TotalParcelas > 1 ? "da entrada" : "à vista";
    return {
      numeroRecibo: `${v.idVistoria}-001`,
      nomePagador: v.NomeCliente?.trim() || "Cliente não identificado",
      documentoPagador: v.CpfCnpj || null,
      valor: v.ValorTotalServico - (v.SaldoDevedor ?? 0),
      dataPagamento: v.DataEmissao,
      formaPagamento: v.DescricaoTipoPagamento || "-",
      referente: `ao pagamento ${tipoPagamento} da Vistoria nº ${v.idVistoria} - Veículo placa ${
        v.PlacaVeiculo
      } - Serviço: ${v.DescricaoServico || "-"}`,
      observacao: v.Observacao,
    };
  }

  async function perguntarEVisualizarReciboAVista(idNovaVistoria: number) {
    const vistoriaCriada = await obterVistoria(idNovaVistoria);
    const nasceuPaga = vistoriaCriada.idStatusVistoria === 1 || vistoriaCriada.idStatusVistoria === 2;
    if (!nasceuPaga) return;

    const verRecibo = await confirmar({
      titulo: "Pagamento à vista",
      mensagem:
        "A 1ª parcela já nasceu paga (lançada direto no caixa - não aparece na tabela de parcelas). Deseja visualizar o recibo agora?",
      textoConfirmar: "Ver recibo",
      textoCancelar: "Agora não",
    });
    if (!verRecibo) return;

    try {
      await visualizarRecibo(dadosReciboAVista(vistoriaCriada));
    } catch (err) {
      if (err instanceof ReciboValorZeroError) {
        await confirmar({ titulo: "Recibo não gerado", mensagem: err.message, apenasOk: true });
      } else {
        mostrarToast("Não foi possível gerar o recibo", "erro");
      }
    }
  }

  async function verReciboAVista() {
    setGerandoReciboAVista(true);
    try {
      const nomeServico = servicos.find((s) => s.idServico === idServico)?.DescricaoServico || "-";
      const formaPagamentoAVista =
        tiposPagamento.find((t) => t.idTipoPagamento === idPrimeiroTipoPagamento)?.DescricaoTipoPagamento || "-";
      await visualizarRecibo(
        dadosReciboAVista({
          idVistoria: id!,
          NomeCliente: nomeCliente,
          CpfCnpj: cpfCnpj,
          ValorTotalServico: valorTotalServico,
          // Usa o SaldoDevedor congelado da Vistoria (gravado só na criação), não o
          // saldoDevedorAtual recalculado a partir das parcelas 2..N - senão uma baixa
          // posterior de outra parcela alteraria por engano o valor deste recibo.
          SaldoDevedor: saldoDevedor,
          DataEmissao: dataEmissao,
          DescricaoTipoPagamento: formaPagamentoAVista,
          PlacaVeiculo: placaVeiculo,
          DescricaoServico: nomeServico,
          Observacao: observacao || null,
          TotalParcelas: Number(totalParcelas),
        })
      );
    } catch (err) {
      if (err instanceof ReciboValorZeroError) {
        await confirmar({ titulo: "Recibo não gerado", mensagem: err.message, apenasOk: true });
      } else {
        mostrarToast("Não foi possível gerar o recibo", "erro");
      }
    } finally {
      setGerandoReciboAVista(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formTotalmenteTravado) return;
    setErro("");

    const parcelasNum = Number(totalParcelas || 1);
    const novosErros: Record<string, string> = {};
    if (!placaVeiculo.trim()) novosErros.placaVeiculo = "Informe a placa do veículo";
    if (!cpfCnpj.trim()) {
      novosErros.cpfCnpj = "Informe o Cpf/Cnpj";
    } else if (!documentoValido(cpfCnpj)) {
      novosErros.cpfCnpj = "Cpf/Cnpj inválido";
    }
    if (!idServico) novosErros.idServico = "Selecione o serviço";
    // Valor 0 é permitido (vistoria de cortesia/retorno, que não gera cobrança) - só valor
    // negativo é inválido, o que o próprio input de moeda já impede de digitar.
    if (valorTotalServico < 0) novosErros.valorUnitarioServico = "O valor total do serviço não pode ser negativo";
    if (parcelasNum < 1) novosErros.totalParcelas = "O número de parcelas deve ser maior que zero";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0 || !idServico) return;

    setSalvando(true);
    try {
      const { idCliente, idResponsavel } = await resolverClienteEResponsavel();

      const dados = {
        dataEmissao,
        placaVeiculo: placaVeiculo.trim().toUpperCase(),
        idCliente,
        idResponsavel,
        idVistoriador: idVistoriador ?? undefined,
        idServico,
        valorUnitarioServico: moedaParaNumero(valorUnitarioServico),
        quantidadeServico: Number(quantidadeServico) || 1,
        valorTotalServico,
        totalParcelas: parcelasNum,
        dataPrimeiraParcela: dataPrimeiraParcela || undefined,
        idPrimeiroTipoPagamento: idPrimeiroTipoPagamento ?? undefined,
        idStatusVistoria: modoEdicao ? idStatusVistoria : undefined,
        observacao: observacao || undefined,
      };

      if (modoEdicao && id !== null) {
        await atualizarVistoria(id, dados);
        mostrarToast("Vistoria atualizada com sucesso", "sucesso");
      } else {
        const { idVistoria } = await criarVistoria(dados);
        mostrarToast("Vistoria lançada com sucesso", "sucesso");
        await perguntarEVisualizarReciboAVista(idVistoria);
      }
      onVoltar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setErro(err.response.data?.erro || "Não foi possível salvar a vistoria");
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

  const parcelasPreview = !modoEdicao ? calcularParcelasPreview(valorTotalServico, Number(totalParcelas), dataPrimeiraParcela) : [];

  return (
    <div className="usuario-form-pagina">
      <div className="usuario-form-cabecalho">
        <button className="usuario-form-voltar" onClick={onVoltar} type="button">
          <ArrowLeft size={18} />
        </button>
        <h2>{modoEdicao ? "Editar Vistoria" : "Lançar Vistoria"}</h2>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={focarProximoCampoAoEnter} className="usuario-form" noValidate>
        <div className="usuario-form-linha">
          <div className="usuario-form-campo conta-receber-form-campo-data">
            <label htmlFor="vf-data-emissao">
              Data de Emissão <span className="obrigatorio">*</span>
            </label>
            <input
              id="vf-data-emissao"
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
              disabled={formTotalmenteTravado}
              required
            />
          </div>

          <div className={`usuario-form-campo usuario-form-campo-status ${erros.placaVeiculo ? "campo-invalido" : ""}`}>
            <label htmlFor="vf-placa">
              Placa do Veículo <span className="obrigatorio">*</span>
            </label>
            <input
              id="vf-placa"
              value={placaVeiculo}
              onChange={(e) => {
                setPlacaVeiculo(e.target.value.toUpperCase());
                if (erros.placaVeiculo) setErros((atual) => ({ ...atual, placaVeiculo: "" }));
              }}
              placeholder="ABC1D23"
              maxLength={7}
              disabled={formTotalmenteTravado}
              required
            />
            {erros.placaVeiculo && <span className="usuario-form-campo-erro">{erros.placaVeiculo}</span>}
          </div>

          <div className={`usuario-form-campo vistoria-form-campo-documento ${erros.cpfCnpj ? "campo-invalido" : ""}`}>
            <label htmlFor="vf-cpf-cnpj">
              Cpf/Cnpj <span className="obrigatorio">*</span>
            </label>
            <input
              id="vf-cpf-cnpj"
              value={cpfCnpj}
              onChange={(e) => {
                setCpfCnpj(formatarDocumento(e.target.value));
                if (erros.cpfCnpj) setErros((atual) => ({ ...atual, cpfCnpj: "" }));
              }}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={18}
              disabled={formTotalmenteTravado}
              required
            />
            {erros.cpfCnpj && <span className="usuario-form-campo-erro">{erros.cpfCnpj}</span>}
          </div>

          <div className="usuario-form-campo usuario-form-combobox">
            <label htmlFor="vf-cliente">
              Cliente {clienteEncontrado ? "(já cadastrado)" : "(nome opcional - deixe em branco se não houver)"}
            </label>
            <div className="usuario-form-campo-com-acao">
              <input
                id="vf-cliente"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                onFocus={() => setMostrarSugestoesCliente(true)}
                onBlur={() => setTimeout(() => setMostrarSugestoesCliente(false), 150)}
                placeholder="Nome do cliente ou digite pra buscar..."
                autoComplete="off"
                maxLength={50}
                disabled={!!clienteEncontrado || formTotalmenteTravado}
                readOnly={!!clienteEncontrado}
              />
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Cadastrar novo cliente"
                aria-label="Cadastrar novo cliente"
                disabled={formTotalmenteTravado}
                onClick={() => setMostrarModalCliente(true)}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
            {mostrarSugestoesCliente && sugestoesClientePorNomeCliente.length > 0 && (
              <ul className="usuario-form-sugestoes">
                {sugestoesClientePorNomeCliente.map((c) => (
                  <li key={`cliente-nome-${c.idCliente}`} onMouseDown={() => selecionarCliente(c)}>
                    {c.NomeCliente} <span className="vistoria-sugestao-doc">({formatarDocumento(c.CpfCnpj)})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-status">
            <label htmlFor="vf-status">Status</label>
            <input
              id="vf-status"
              className={`conta-receber-form-status-select ${statusVistoriaInfo(idStatusVistoria).classe}`}
              value={statusVistoriaInfo(idStatusVistoria).label}
              disabled
              readOnly
              title="Definido automaticamente pelo sistema, conforme a situação das parcelas"
            />
          </div>
        </div>

        <div className="usuario-form-linha">
          {clienteEncontrado ? (
            <div className="usuario-form-campo conta-receber-form-campo-categoria-larga">
              <label htmlFor="vf-responsavel">Responsável (Cliente)</label>
              <div className="usuario-form-campo-com-acao">
                <select
                  id="vf-responsavel"
                  value={idResponsavel ?? ""}
                  onChange={(e) => setIdResponsavel(e.target.value ? Number(e.target.value) : null)}
                  disabled={formTotalmenteTravado}
                >
                  <option value="">Nenhum</option>
                  {sugestoesResponsavel.map((r) => (
                    <option key={r.idResponsavel} value={r.idResponsavel}>
                      {r.NomeResponsavel}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="usuario-form-btn-navegar"
                  title="Cadastrar novo responsável"
                  aria-label="Cadastrar novo responsável"
                  disabled={formTotalmenteTravado}
                  onClick={() => setMostrarModalResponsavel(true)}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="usuario-form-campo usuario-form-combobox">
              <label htmlFor="vf-responsavel">Responsável (Cliente)</label>
              <input
                id="vf-responsavel"
                value={nomeResponsavel}
                onChange={(e) => setNomeResponsavel(e.target.value)}
                onFocus={() => setMostrarSugestoesResponsavel(true)}
                onBlur={() => setTimeout(() => setMostrarSugestoesResponsavel(false), 150)}
                placeholder="Nome do responsável ou do cliente..."
                autoComplete="off"
                disabled={formTotalmenteTravado}
              />
              {mostrarSugestoesResponsavel && sugestoesClientePorNome.length > 0 && (
                <ul className="usuario-form-sugestoes">
                  {sugestoesClientePorNome.map((c) => (
                    <li key={`cliente-${c.idCliente}`} onMouseDown={() => selecionarCliente(c)}>
                      {c.NomeCliente} <span className="vistoria-sugestao-doc">({formatarDocumento(c.CpfCnpj)})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="usuario-form-campo conta-receber-form-campo-categoria-larga">
            <label htmlFor="vf-vistoriador">Vistoriador</label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="vf-vistoriador"
                value={idVistoriador ?? ""}
                onChange={(e) => setIdVistoriador(e.target.value ? Number(e.target.value) : null)}
                disabled={formTotalmenteTravado}
              >
                <option value="">Selecione...</option>
                {vistoriadores.map((f) => (
                  <option key={f.IdFuncionario} value={f.IdFuncionario}>
                    {f.NomeFuncionario}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Cadastrar novo vistoriador"
                aria-label="Cadastrar novo vistoriador"
                disabled={formTotalmenteTravado}
                onClick={() => setMostrarModalVistoriador(true)}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className={`usuario-form-campo conta-receber-form-campo-categoria-larga ${erros.idServico ? "campo-invalido" : ""}`}>
            <label htmlFor="vf-servico">
              Serviço <span className="obrigatorio">*</span>
            </label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="vf-servico"
                value={idServico ?? ""}
                onChange={(e) => {
                  selecionarServico(e.target.value ? Number(e.target.value) : null);
                  if (erros.idServico) setErros((atual) => ({ ...atual, idServico: "" }));
                }}
                disabled={modoEdicao}
                required
              >
                <option value="">Selecione...</option>
                {servicos.map((s) => (
                  <option key={s.idServico} value={s.idServico}>
                    {s.DescricaoServico}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="usuario-form-btn-navegar"
                title="Cadastrar novo serviço"
                aria-label="Cadastrar novo serviço"
                disabled={modoEdicao}
                onClick={() => setMostrarModalServico(true)}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
            {erros.idServico && <span className="usuario-form-campo-erro">{erros.idServico}</span>}
          </div>

          <div className={`usuario-form-campo conta-receber-form-campo-valor ${erros.valorUnitarioServico ? "campo-invalido" : ""}`}>
            <label htmlFor="vf-valor-unitario">Valor Unitário</label>
            <input
              id="vf-valor-unitario"
              value={valorUnitarioServico}
              onChange={(e) => {
                setValorUnitarioServico(formatarMoeda(e.target.value));
                if (erros.valorUnitarioServico) setErros((atual) => ({ ...atual, valorUnitarioServico: "" }));
              }}
              placeholder="R$ 0,00"
              inputMode="numeric"
              disabled={modoEdicao}
            />
            {erros.valorUnitarioServico && (
              <span className="usuario-form-campo-erro">{erros.valorUnitarioServico}</span>
            )}
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-numero">
            <label htmlFor="vf-quantidade">Quantidade</label>
            <input
              id="vf-quantidade"
              type="number"
              min={1}
              value={quantidadeServico}
              onChange={(e) => setQuantidadeServico(e.target.value)}
              disabled={modoEdicao}
            />
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-valor">
            <label>Valor Total</label>
            <input value={numeroParaMoeda(valorTotalServico)} disabled readOnly />
          </div>
        </div>

        <div className="usuario-form-linha">
          <div className={`usuario-form-campo conta-receber-form-campo-numero ${erros.totalParcelas ? "campo-invalido" : ""}`}>
            <label htmlFor="vf-total-parcelas">
              Nº de Parcelas <span className="obrigatorio">*</span>
            </label>
            <input
              id="vf-total-parcelas"
              type="number"
              min={1}
              value={totalParcelas}
              onChange={(e) => {
                setTotalParcelas(e.target.value);
                if (erros.totalParcelas) setErros((atual) => ({ ...atual, totalParcelas: "" }));
              }}
              disabled={modoEdicao}
              required
            />
            {erros.totalParcelas && <span className="usuario-form-campo-erro">{erros.totalParcelas}</span>}
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-data">
            <label htmlFor="vf-primeiro-vencimento">1º Vencimento</label>
            <input
              id="vf-primeiro-vencimento"
              type="date"
              value={dataPrimeiraParcela}
              onChange={(e) => setDataPrimeiraParcela(e.target.value)}
              disabled={modoEdicao}
            />
          </div>

          <div className="usuario-form-campo conta-receber-form-campo-tipo-pagamento">
            <label htmlFor="vf-tipo-pagamento">1º Tipo de Pagamento</label>
            <div className="usuario-form-campo-com-acao">
              <select
                id="vf-tipo-pagamento"
                value={idPrimeiroTipoPagamento ?? ""}
                onChange={(e) => setIdPrimeiroTipoPagamento(e.target.value ? Number(e.target.value) : null)}
                disabled={modoEdicao}
              >
                <option value="">Selecione...</option>
                {tiposPagamentoDisponiveis.map((t) => (
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
                disabled={modoEdicao}
                onClick={() => setMostrarModalTipoPagamento(true)}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>

          {modoEdicao && saldoDevedorAtual !== null && (
            <div className="usuario-form-campo conta-receber-form-campo-valor">
              <label>Saldo Devedor</label>
              <input value={numeroParaMoeda(saldoDevedorAtual)} disabled readOnly />
            </div>
          )}
        </div>

        {formTotalmenteTravado ? (
          <p className="vistoria-form-dica-travado">
            Esta vistoria já está {statusVistoriaInfo(idStatusVistoria).label.toLowerCase()} - nenhum
            campo do cabeçalho pode ser alterado nem a vistoria pode ser excluída (regra do
            próprio banco de dados). Você ainda pode dar baixa ou estornar as parcelas abaixo.
          </p>
        ) : (
          modoEdicao && (
            <p className="vistoria-form-dica-travado">
              Serviço, valores, nº de parcelas, 1º vencimento e 1º tipo de pagamento não podem
              ser alterados depois que a vistoria é lançada (o cronograma de pagamento já foi
              gerado). Para corrigir esses dados, exclua e lance a vistoria novamente.
            </p>
          )
        )}

        <div className="usuario-form-campo">
          <label htmlFor="vf-observacao">Observações</label>
          <textarea
            id="vf-observacao"
            className="conta-receber-form-textarea"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            disabled={formTotalmenteTravado}
          />
        </div>

        {modoEdicao && (
          <div className="usuario-form-linha">
            <div className="usuario-form-campo">
              <label>Responsável pela Emissão</label>
              <input value={responsavelEmissao} disabled readOnly />
            </div>
            <div className="usuario-form-campo">
              <label>Usuário Alteração</label>
              <input value={usuarioAlteracao} disabled readOnly />
            </div>
            <div className="usuario-form-campo">
              <label>Data Alteração</label>
              <input value={dataAlteracao ? new Date(dataAlteracao).toLocaleString("pt-BR") : ""} disabled readOnly />
            </div>
          </div>
        )}

        {!modoEdicao && parcelasPreview.length > 0 && (
          <div className="conta-receber-form-parcelas">
            <h3>Parcelas (prévia)</h3>
            <div className="conta-receber-form-parcelas-tabela-wrapper">
              <table className="conta-receber-form-parcelas-tabela">
                <thead>
                  <tr>
                    <th>Parcela</th>
                    <th>Vencimento</th>
                    <th className="conta-receber-col-valor">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelasPreview.map((p) => (
                    <tr key={p.numero}>
                      <td>{pad3(p.numero)}</td>
                      <td>{new Date(`${p.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td className="conta-receber-col-valor">{numeroParaMoeda(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {modoEdicao && (idStatusVistoria === 1 || idStatusVistoria === 2) && (
          <div className="vistoria-form-avista">
            <p>
              A 1ª parcela nasceu paga (pagamento à vista lançado direto no caixa) - por isso não aparece na
              tabela de parcelas abaixo.
            </p>
            <button
              type="button"
              className="vistoria-form-btn-recibo-avista"
              disabled={gerandoReciboAVista}
              onClick={verReciboAVista}
            >
              <Eye size={16} />
              Visualizar recibo
            </button>
          </div>
        )}

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
                    const { label, classe } = statusVistoriaInfo(p.IdStatusParcela);
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

        {!formTotalmenteTravado && (
          <button type="submit" className="usuario-form-btn-salvar" disabled={salvando}>
            {salvando ? "Salvando..." : modoEdicao ? "Salvar" : "Lançar Vistoria"}
            <Send size={16} />
          </button>
        )}
      </form>

      {parcelaEmBaixa && idContaReceber !== null && (
        <ContaReceberBaixaModal
          idContaReceber={idContaReceber}
          parcela={parcelaEmBaixa}
          onCancelar={() => setParcelaEmBaixa(null)}
          onBaixada={handleParcelaBaixada}
        />
      )}

      {parcelaEmEstorno && idContaReceber !== null && (
        <ContaReceberEstornoModal
          idContaReceber={idContaReceber}
          parcela={parcelaEmEstorno}
          onCancelar={() => setParcelaEmEstorno(null)}
          onEstornada={handleParcelaEstornada}
        />
      )}

      {mostrarModalCliente && (
        <ClienteModal onCancelar={() => setMostrarModalCliente(false)} onCriado={handleClienteCriado} />
      )}

      {mostrarModalResponsavel && clienteEncontrado && (
        <ResponsavelModal
          idCliente={clienteEncontrado.idCliente}
          onCancelar={() => setMostrarModalResponsavel(false)}
          onCriado={handleResponsavelCriado}
        />
      )}

      {mostrarModalVistoriador && (
        <FuncionarioModal onCancelar={() => setMostrarModalVistoriador(false)} onCriado={handleVistoriadorCriado} />
      )}

      {mostrarModalServico && (
        <ServicoModal onCancelar={() => setMostrarModalServico(false)} onCriado={handleServicoCriado} />
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

export default VistoriaForm;
