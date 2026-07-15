import { Router } from "express";
import type { ConnectionPool, Transaction } from "mssql";
import { getPool, sql } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

// Executor genérico: tanto o pool quanto uma transação expõem .request(),
// usado pelas duas procedures chamadas juntas na baixa manual de parcela.
type Executor = ConnectionPool | Transaction;

const router = Router();

const SELECT_BASE = `
  SELECT
    cp.idContaPagar, cp.NumeroDocumento, cp.Descricao,
    cp.idFornecedor, f.RazaoSocial,
    cp.idCategoria, c.DescricaoCategoria,
    cp.ValorTotal, cp.TotalParcelas, cp.DataPrimeiraParcela,
    cp.IdPrimeiroTipoPagamento, tp.TipoPagamento AS DescricaoTipoPagamento,
    cp.IntervaloMeses, cp.IdStatusContaPagar, cp.SaldoDevedor,
    cp.DataEmissao, cp.Observacao,
    cp.idUsuarioEmissao, cp.idUsuarioAlteracao, cp.DataAlteracao
  FROM ContaPagar cp
  LEFT JOIN Fornecedor f ON f.idFornecedor = cp.idFornecedor
  JOIN Categoria c ON c.IdCategoria = cp.idCategoria
  LEFT JOIN TipoPagamento tp ON tp.idTipoPagamento = cp.IdPrimeiroTipoPagamento
`;

const SELECT_PARCELAS = `
  SELECT
    p.IdContaPagarParcela, p.IdContaPagar, p.NumeroParcela,
    p.ValorParcela, p.ValorDesconto, p.ValorJuros, p.ValorMulta, p.ValorPago,
    p.DataVencimento, p.DataPagamento, p.IdStatusParcela,
    p.IdTipoPagamento, tp.TipoPagamento AS DescricaoTipoPagamento,
    p.Observacao
  FROM ContaPagarParcela p
  LEFT JOIN TipoPagamento tp ON tp.idTipoPagamento = p.IdTipoPagamento
  WHERE p.IdContaPagar = @id
  ORDER BY p.NumeroParcela
`;

interface ParametrosManterContaPagar {
  acao: "I" | "A" | "D";
  idContaPagar?: number | null;
  numeroDocumento?: string | null;
  descricao?: string | null;
  idFornecedor?: number | null;
  idCategoria?: number | null;
  valorTotal?: number | null;
  totalParcelas?: number | null;
  idStatusContaPagar?: number | null;
  dataEmissao?: Date | null;
  observacao?: string | null;
  idUsuarioEmissao?: number | null;
  idUsuarioAlteracao?: number | null;
  dataAlteracao?: Date | null;
  primeiroVencimento?: Date | null;
  idPrimeiroTipoPagamento?: number | null;
  mesesIntervalo?: number | null;
  idUsuarioBaixa?: number | null;
  login?: string | null;
  nomeFuncionario?: string | null;
  recalcularParcelas?: boolean;
}

// Chama a stored procedure legada Manter_ContaPagar (INSERT/UPDATE/DELETE transacional do
// cabeçalho + geração automática de parcelas + baixa automática/movimento de caixa quando a
// emissão coincide com um vencimento). Regras de negócio completas vivem na procedure, não aqui.
async function chamarManterContaPagar(
  pool: Awaited<ReturnType<typeof getPool>>,
  params: ParametrosManterContaPagar
): Promise<number | undefined> {
  const request = pool
    .request()
    .input("acao", sql.Char(1), params.acao)
    .input("IdContaPagar", sql.Int, params.idContaPagar ?? null)
    .input("NumeroDocumento", sql.VarChar(50), params.numeroDocumento ?? null)
    .input("Descricao", sql.VarChar(255), params.descricao ?? null)
    .input("idFornecedor", sql.Int, params.idFornecedor ?? null)
    .input("idCategoria", sql.Int, params.idCategoria ?? null)
    .input("ValorTotal", sql.Money, params.valorTotal ?? null)
    .input("TotalParcelas", sql.SmallInt, params.totalParcelas ?? null)
    .input("IdStatusContaPagar", sql.Int, params.idStatusContaPagar ?? null)
    .input("SaldoDevedor", sql.Money, null)
    .input("DataEmissao", sql.DateTime, params.dataEmissao ?? null)
    .input("Observacao", sql.VarChar(sql.MAX), params.observacao ?? null)
    .input("idUsuarioEmissao", sql.Int, params.idUsuarioEmissao ?? null)
    .input("idUsuarioAlteracao", sql.Int, params.idUsuarioAlteracao ?? null)
    .input("DataAlteracao", sql.DateTime, params.dataAlteracao ?? null)
    .input("PrimeiroVencimento", sql.Date, params.primeiroVencimento ?? null)
    .input("IdPrimeiroTipoPagamento", sql.Int, params.idPrimeiroTipoPagamento ?? null)
    .input("MesesIntervalo", sql.SmallInt, params.mesesIntervalo ?? 1)
    .input("idUsuarioBaixa", sql.Int, params.idUsuarioBaixa ?? null)
    .input("login", sql.VarChar(50), params.login ?? null)
    .input("NomeFuncionario", sql.VarChar(100), params.nomeFuncionario ?? null)
    .input("RecalcularParcelas", sql.Bit, params.recalcularParcelas ?? false);

  const result = await request.execute("Manter_ContaPagar");
  return result.recordset?.[0]?.IDNovo;
}

interface ParametrosManterContaPagarParcela {
  acao: "I" | "A" | "D";
  idContaPagarParcela?: number | null;
  idContaPagar?: number | null;
  numeroParcela?: number | null;
  valorParcela?: number | null;
  valorDesconto?: number | null;
  valorJuros?: number | null;
  valorMulta?: number | null;
  valorPago?: number | null;
  dataVencimento?: Date | null;
  dataPagamento?: Date | null;
  idTipoPagamento?: number | null;
  idStatusParcela?: number | null;
  observacao?: string | null;
  idUsuarioBaixa?: number | null;
  idUsuarioEstorno?: number | null;
  dataAlteracao?: Date | null;
}

// Chama Manter_ContaPagar_Parcela: CRUD simples de uma parcela isolada (não mexe em caixa).
// Usada pela baixa/estorno manual junto com chamarManterCaixaMovimento, na mesma transação.
async function chamarManterContaPagarParcela(
  exec: Executor,
  params: ParametrosManterContaPagarParcela
): Promise<number | undefined> {
  const request = exec
    .request()
    .input("acao", sql.Char(1), params.acao)
    .input("idContaPagarParcela", sql.Int, params.idContaPagarParcela ?? null)
    .input("idContaPagar", sql.Int, params.idContaPagar ?? null)
    .input("NumeroParcela", sql.SmallInt, params.numeroParcela ?? null)
    .input("ValorParcela", sql.Decimal(18, 2), params.valorParcela ?? null)
    .input("ValorDesconto", sql.Decimal(18, 2), params.valorDesconto ?? null)
    .input("ValorJuros", sql.Decimal(18, 2), params.valorJuros ?? null)
    .input("ValorMulta", sql.Decimal(18, 2), params.valorMulta ?? null)
    .input("ValorPago", sql.Decimal(18, 2), params.valorPago ?? null)
    .input("DataVencimento", sql.Date, params.dataVencimento ?? null)
    .input("DataPagamento", sql.Date, params.dataPagamento ?? null)
    .input("idTipoPagamento", sql.Int, params.idTipoPagamento ?? null)
    .input("idStatusParcela", sql.SmallInt, params.idStatusParcela ?? null)
    .input("Observacao", sql.VarChar(sql.MAX), params.observacao ?? null)
    .input("idUsuarioBaixa", sql.Int, params.idUsuarioBaixa ?? null)
    .input("idUsuarioEstorno", sql.Int, params.idUsuarioEstorno ?? null)
    .input("DataAlteracao", sql.DateTime, params.dataAlteracao ?? null);

  const result = await request.execute("Manter_ContaPagar_Parcela");
  return result.recordset?.[0]?.IDNovo;
}

interface ParametrosManterCaixaMovimento {
  idCaixa: number;
  tipoMovimento: "E" | "S";
  valor: number;
  tipoOrigem: number;
  idOrigem: number;
  descricao: string;
  idUsuario: number;
  idFormaPagamento?: number | null;
}

// Chama Manter_CaixaMovimento: registra o lançamento de caixa correspondente à baixa/estorno.
async function chamarManterCaixaMovimento(
  exec: Executor,
  params: ParametrosManterCaixaMovimento
): Promise<number | undefined> {
  const request = exec
    .request()
    .output("IdMovimento", sql.Int)
    .input("IdCaixa", sql.Int, params.idCaixa)
    .input("TipoMovimento", sql.VarChar(1), params.tipoMovimento)
    .input("Valor", sql.Decimal(18, 2), params.valor)
    .input("TipoOrigem", sql.Int, params.tipoOrigem)
    .input("idOrigem", sql.Int, params.idOrigem)
    .input("Descricao", sql.VarChar(255), params.descricao.slice(0, 255))
    .input("idUsuario", sql.Int, params.idUsuario)
    .input("idFormaPagamento", sql.Int, params.idFormaPagamento ?? null);

  const result = await request.execute("Manter_CaixaMovimento");
  return result.output.IdMovimento as number | undefined;
}

// GET /conta-pagar?busca=&status= - lista com filtros
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const status = (req.query.status as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("(cp.NumeroDocumento LIKE @busca OR cp.Descricao LIKE @busca OR f.RazaoSocial LIKE @busca)");
    }
    if (status !== undefined && status !== "" && !Number.isNaN(Number(status))) {
      request.input("status", sql.Int, Number(status));
      condicoes.push("cp.IdStatusContaPagar = @status");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY cp.idContaPagar DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar contas a pagar" });
  }
});

// GET /conta-pagar/:id - cabeçalho + parcelas (para edição/visualização)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const cabecalho = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE cp.idContaPagar = @id`);

    const conta = cabecalho.recordset[0];
    if (!conta) return res.status(404).json({ erro: "Conta a pagar não encontrada" });

    const parcelas = await pool.request().input("id", sql.Int, req.params.id).query(SELECT_PARCELAS);

    res.json({ ...conta, parcelas: parcelas.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar conta a pagar" });
  }
});

// POST /conta-pagar - cria uma conta a pagar (e gera as parcelas, via Manter_ContaPagar @acao='I')
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const {
    numeroDocumento,
    descricao,
    idFornecedor,
    idCategoria,
    valorTotal,
    totalParcelas,
    primeiroVencimento,
    idPrimeiroTipoPagamento,
    intervaloMeses,
    idStatusContaPagar,
    dataEmissao,
    observacao,
  } = req.body;

  if (!descricao || !idCategoria || !valorTotal || totalParcelas === undefined || !dataEmissao) {
    return res
      .status(400)
      .json({ erro: "descricao, idCategoria, valorTotal, totalParcelas e dataEmissao são obrigatórios" });
  }
  if (valorTotal <= 0) return res.status(400).json({ erro: "valorTotal deve ser maior que zero" });
  if (totalParcelas < 0) return res.status(400).json({ erro: "totalParcelas não pode ser negativo" });

  try {
    const pool = await getPool();

    const idContaPagar = await chamarManterContaPagar(pool, {
      acao: "I",
      numeroDocumento: numeroDocumento || null,
      descricao,
      idFornecedor: idFornecedor || null,
      idCategoria,
      valorTotal,
      totalParcelas,
      idStatusContaPagar: idStatusContaPagar ?? 0,
      dataEmissao: new Date(dataEmissao),
      observacao: observacao || null,
      idUsuarioEmissao: req.user!.id,
      primeiroVencimento: primeiroVencimento ? new Date(primeiroVencimento) : null,
      idPrimeiroTipoPagamento: idPrimeiroTipoPagamento || null,
      mesesIntervalo: intervaloMeses || 1,
      idUsuarioBaixa: req.user!.id,
      login: req.user!.login,
      nomeFuncionario: req.user!.nome,
    });

    res.status(201).json({ idContaPagar });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao criar conta a pagar" });
  }
});

// PUT /conta-pagar/:id - edita cabeçalho (e recria parcelas via Manter_ContaPagar @acao='A',
// somente se nenhuma parcela tiver sido paga e @recalcularParcelas=true)
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const {
    numeroDocumento,
    descricao,
    idFornecedor,
    idCategoria,
    valorTotal,
    totalParcelas,
    primeiroVencimento,
    idPrimeiroTipoPagamento,
    intervaloMeses,
    idStatusContaPagar,
    dataEmissao,
    observacao,
    recalcularParcelas,
  } = req.body;

  if (!descricao || !idCategoria || !valorTotal || totalParcelas === undefined || !dataEmissao) {
    return res
      .status(400)
      .json({ erro: "descricao, idCategoria, valorTotal, totalParcelas e dataEmissao são obrigatórios" });
  }
  if (valorTotal <= 0) return res.status(400).json({ erro: "valorTotal deve ser maior que zero" });
  if (totalParcelas < 0) return res.status(400).json({ erro: "totalParcelas não pode ser negativo" });

  try {
    const pool = await getPool();

    // idUsuarioEmissao é preservado (a procedure sempre regrava essa coluna com o valor
    // recebido) - buscamos o valor atual em vez de deixar a edição roubar a autoria original.
    const atual = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT idUsuarioEmissao FROM ContaPagar WHERE idContaPagar = @id");
    if (atual.recordset.length === 0) {
      return res.status(404).json({ erro: "Conta a pagar não encontrada" });
    }

    await chamarManterContaPagar(pool, {
      acao: "A",
      idContaPagar: Number(req.params.id),
      numeroDocumento: numeroDocumento || null,
      descricao,
      idFornecedor: idFornecedor || null,
      idCategoria,
      valorTotal,
      totalParcelas,
      idStatusContaPagar: idStatusContaPagar ?? 0,
      dataEmissao: new Date(dataEmissao),
      observacao: observacao || null,
      idUsuarioEmissao: atual.recordset[0].idUsuarioEmissao,
      idUsuarioAlteracao: req.user!.id,
      dataAlteracao: new Date(),
      primeiroVencimento: primeiroVencimento ? new Date(primeiroVencimento) : null,
      idPrimeiroTipoPagamento: idPrimeiroTipoPagamento || null,
      mesesIntervalo: intervaloMeses || 1,
      idUsuarioBaixa: req.user!.id,
      login: req.user!.login,
      nomeFuncionario: req.user!.nome,
      recalcularParcelas: !!recalcularParcelas,
    });

    res.json({ mensagem: "Conta a pagar atualizada" });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao atualizar conta a pagar" });
  }
});

// DELETE /conta-pagar/:id - exclusão definitiva do cabeçalho e das parcelas (Manter_ContaPagar @acao='D').
// Sem exclusão parcial: a procedure sempre apaga parcelas + cabeçalho juntos, mesmo com parcela já paga.
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    await chamarManterContaPagar(pool, { acao: "D", idContaPagar: Number(req.params.id) });
    res.json({ mensagem: "Conta a pagar excluída" });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao excluir conta a pagar" });
  }
});

// POST /conta-pagar/:idConta/parcelas/:idParcela/baixa - baixa manual de uma parcela avulsa.
// Fora da procedure Manter_ContaPagar (que só baixa automaticamente na emissão): aqui o usuário
// informa data de pagamento/desconto/juros/multa/tipo de pagamento e confirma manualmente.
// Precisa de caixa aberto (mesma regra da baixa automática) e gera o respectivo movimento de caixa.
// Manter_ContaPagar_Parcela e Manter_CaixaMovimento rodam na mesma transação para não deixar a
// parcela marcada como paga sem o lançamento de caixa correspondente (ou vice-versa).
router.post("/:idConta/parcelas/:idParcela/baixa", authMiddleware, async (req: AuthRequest, res) => {
  const { dataPagamento, valorDesconto, valorJuros, valorMulta, idTipoPagamento } = req.body;

  if (!dataPagamento) {
    return res.status(400).json({ erro: "dataPagamento é obrigatório" });
  }
  // idFormaPagamento não aceita NULL em CaixaMovimento - a baixa sempre gera um lançamento de caixa.
  if (!idTipoPagamento) {
    return res.status(400).json({ erro: "Tipo de pagamento é obrigatório" });
  }
  const desconto = Number(valorDesconto) || 0;
  const juros = Number(valorJuros) || 0;
  const multa = Number(valorMulta) || 0;
  if (desconto < 0 || juros < 0 || multa < 0) {
    return res.status(400).json({ erro: "Desconto, juros e multa não podem ser negativos" });
  }

  try {
    const pool = await getPool();

    const parcelaResult = await pool
      .request()
      .input("idParcela", sql.Int, req.params.idParcela)
      .input("idConta", sql.Int, req.params.idConta)
      .query(
        `SELECT IdContaPagarParcela, IdContaPagar, NumeroParcela, ValorParcela, DataVencimento,
                IdStatusParcela, ValorPago, DataPagamento
         FROM ContaPagarParcela
         WHERE IdContaPagarParcela = @idParcela AND IdContaPagar = @idConta`
      );
    const parcela = parcelaResult.recordset[0];
    if (!parcela) return res.status(404).json({ erro: "Parcela não encontrada" });

    const jaPaga = parcela.IdStatusParcela !== 0 || parcela.ValorPago > 0 || !!parcela.DataPagamento;
    if (jaPaga) {
      return res.status(400).json({ erro: "Esta parcela já foi baixada" });
    }

    const caixaResult = await pool
      .request()
      .query(
        `SELECT TOP 1 idCaixa FROM Caixa WHERE DataFechamento IS NULL AND SaldoFinal IS NULL ORDER BY DataAbertura DESC`
      );
    const idCaixa = caixaResult.recordset[0]?.idCaixa;
    if (!idCaixa) {
      return res
        .status(400)
        .json({ erro: "Não há caixa aberto. Abra um caixa antes de dar baixa em uma parcela." });
    }

    const valorPago = Number(parcela.ValorParcela) - desconto + juros + multa;
    const agora = new Date();
    const observacao = `[Baixa ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })} | Usuário: ${req.user!.nome} / ${req.user!.id} - ${req.user!.login}] Baixa manual`;

    const transaction = pool.transaction();
    await transaction.begin();
    try {
      await chamarManterContaPagarParcela(transaction, {
        acao: "A",
        idContaPagarParcela: parcela.IdContaPagarParcela,
        idContaPagar: parcela.IdContaPagar,
        numeroParcela: parcela.NumeroParcela,
        valorParcela: parcela.ValorParcela,
        valorDesconto: desconto,
        valorJuros: juros,
        valorMulta: multa,
        valorPago,
        dataVencimento: parcela.DataVencimento,
        dataPagamento: new Date(dataPagamento),
        idTipoPagamento: idTipoPagamento || null,
        idStatusParcela: 1,
        observacao,
        idUsuarioBaixa: req.user!.id,
        idUsuarioEstorno: null,
        dataAlteracao: agora,
      });

      await chamarManterCaixaMovimento(transaction, {
        idCaixa,
        tipoMovimento: "S",
        valor: valorPago,
        tipoOrigem: 1,
        idOrigem: parcela.IdContaPagarParcela,
        descricao: observacao,
        idUsuario: req.user!.id,
        idFormaPagamento: idTipoPagamento || null,
      });

      // Recalcula status/saldo do cabeçalho com base nas parcelas efetivamente pagas
      // (mesma lógica de RN-007/RN-014 da Manter_ContaPagar, só que disparada pela baixa manual).
      const totaisResult = await transaction
        .request()
        .input("idConta", sql.Int, parcela.IdContaPagar)
        .query(
          `SELECT
             COUNT(*) AS Total,
             SUM(CASE WHEN IdStatusParcela = 1 THEN 1 ELSE 0 END) AS Pagas,
             SUM(CASE WHEN IdStatusParcela = 1 THEN ValorParcela ELSE 0 END) AS TotalPago
           FROM ContaPagarParcela WHERE IdContaPagar = @idConta`
        );
      const { Total, Pagas, TotalPago } = totaisResult.recordset[0];

      const contaResult = await transaction
        .request()
        .input("idConta", sql.Int, parcela.IdContaPagar)
        .query("SELECT ValorTotal, IdStatusContaPagar FROM ContaPagar WHERE idContaPagar = @idConta");
      const conta = contaResult.recordset[0];

      let novoStatus = conta.IdStatusContaPagar;
      if (Total > 0 && Pagas === Total) novoStatus = 1;
      else if (Pagas > 0) novoStatus = 2;

      const saldoDevedor = Math.max(0, Number(conta.ValorTotal) - Number(TotalPago));

      await transaction
        .request()
        .input("idConta", sql.Int, parcela.IdContaPagar)
        .input("status", sql.Int, novoStatus)
        .input("saldo", sql.Money, saldoDevedor)
        .input("idUsuarioAlteracao", sql.Int, req.user!.id)
        .input("dataAlteracao", sql.DateTime, agora)
        .query(
          `UPDATE ContaPagar SET IdStatusContaPagar = @status, SaldoDevedor = @saldo,
                  idUsuarioAlteracao = @idUsuarioAlteracao, DataAlteracao = @dataAlteracao
           WHERE idContaPagar = @idConta`
        );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.json({ mensagem: "Parcela baixada com sucesso" });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao baixar parcela" });
  }
});

// POST /conta-pagar/:idConta/parcelas/:idParcela/estorno - desfaz a baixa de uma parcela paga.
// Simétrico à baixa: reverte a parcela para pendente (zera valores de pagamento) e lança um
// movimento de caixa de entrada (estorno da saída original), na mesma transação. Exige
// observação (motivo do estorno) e caixa aberto, pois o estorno também precisa de um caixa
// para registrar o lançamento de reversão.
router.post("/:idConta/parcelas/:idParcela/estorno", authMiddleware, async (req: AuthRequest, res) => {
  const { observacao } = req.body;

  if (!observacao || !String(observacao).trim()) {
    return res.status(400).json({ erro: "Observação é obrigatória para estornar a parcela" });
  }

  try {
    const pool = await getPool();

    const parcelaResult = await pool
      .request()
      .input("idParcela", sql.Int, req.params.idParcela)
      .input("idConta", sql.Int, req.params.idConta)
      .query(
        `SELECT IdContaPagarParcela, IdContaPagar, NumeroParcela, ValorParcela, DataVencimento,
                IdStatusParcela, ValorPago, IdTipoPagamento
         FROM ContaPagarParcela
         WHERE IdContaPagarParcela = @idParcela AND IdContaPagar = @idConta`
      );
    const parcela = parcelaResult.recordset[0];
    if (!parcela) return res.status(404).json({ erro: "Parcela não encontrada" });

    const paga = parcela.IdStatusParcela !== 0 || parcela.ValorPago > 0;
    if (!paga) {
      return res.status(400).json({ erro: "Esta parcela ainda não foi baixada" });
    }

    const caixaResult = await pool
      .request()
      .query(
        `SELECT TOP 1 idCaixa FROM Caixa WHERE DataFechamento IS NULL AND SaldoFinal IS NULL ORDER BY DataAbertura DESC`
      );
    const idCaixa = caixaResult.recordset[0]?.idCaixa;
    if (!idCaixa) {
      return res
        .status(400)
        .json({ erro: "Não há caixa aberto. Abra um caixa antes de estornar uma parcela." });
    }

    const valorEstornado = Number(parcela.ValorPago);
    const agora = new Date();
    const obs = `[Estorno ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })} | Usuário: ${req.user!.nome} / ${req.user!.id} - ${req.user!.login}] ${String(observacao).trim()}`;

    const transaction = pool.transaction();
    await transaction.begin();
    try {
      await chamarManterContaPagarParcela(transaction, {
        acao: "A",
        idContaPagarParcela: parcela.IdContaPagarParcela,
        idContaPagar: parcela.IdContaPagar,
        numeroParcela: parcela.NumeroParcela,
        valorParcela: parcela.ValorParcela,
        valorDesconto: 0,
        valorJuros: 0,
        valorMulta: 0,
        valorPago: 0,
        dataVencimento: parcela.DataVencimento,
        dataPagamento: null,
        idTipoPagamento: null,
        idStatusParcela: 0,
        observacao: obs,
        idUsuarioBaixa: null,
        idUsuarioEstorno: req.user!.id,
        dataAlteracao: agora,
      });

      await chamarManterCaixaMovimento(transaction, {
        idCaixa,
        tipoMovimento: "E",
        valor: valorEstornado,
        tipoOrigem: 1,
        idOrigem: parcela.IdContaPagarParcela,
        descricao: obs,
        idUsuario: req.user!.id,
        idFormaPagamento: parcela.IdTipoPagamento,
      });

      // Recalcula status/saldo do cabeçalho com base nas parcelas efetivamente pagas
      // (mesma lógica usada na baixa manual, aplicada em sentido inverso).
      const totaisResult = await transaction
        .request()
        .input("idConta", sql.Int, parcela.IdContaPagar)
        .query(
          `SELECT
             COUNT(*) AS Total,
             SUM(CASE WHEN IdStatusParcela = 1 THEN 1 ELSE 0 END) AS Pagas,
             SUM(CASE WHEN IdStatusParcela = 1 THEN ValorParcela ELSE 0 END) AS TotalPago
           FROM ContaPagarParcela WHERE IdContaPagar = @idConta`
        );
      const { Total, Pagas, TotalPago } = totaisResult.recordset[0];

      const contaResult = await transaction
        .request()
        .input("idConta", sql.Int, parcela.IdContaPagar)
        .query("SELECT ValorTotal FROM ContaPagar WHERE idContaPagar = @idConta");
      const conta = contaResult.recordset[0];

      let novoStatus = 0;
      if (Total > 0 && Pagas === Total) novoStatus = 1;
      else if (Pagas > 0) novoStatus = 2;

      const saldoDevedor = Math.max(0, Number(conta.ValorTotal) - Number(TotalPago));

      await transaction
        .request()
        .input("idConta", sql.Int, parcela.IdContaPagar)
        .input("status", sql.Int, novoStatus)
        .input("saldo", sql.Money, saldoDevedor)
        .input("idUsuarioAlteracao", sql.Int, req.user!.id)
        .input("dataAlteracao", sql.DateTime, agora)
        .query(
          `UPDATE ContaPagar SET IdStatusContaPagar = @status, SaldoDevedor = @saldo,
                  idUsuarioAlteracao = @idUsuarioAlteracao, DataAlteracao = @dataAlteracao
           WHERE idContaPagar = @idConta`
        );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.json({ mensagem: "Parcela estornada com sucesso" });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao estornar parcela" });
  }
});

export default router;
