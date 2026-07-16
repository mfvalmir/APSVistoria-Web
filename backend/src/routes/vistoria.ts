import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { parseDataLocal } from "../utils/data";

const router = Router();

const SELECT_BASE = `
  SELECT
    v.idVistoria, v.DataEmissao, v.PlacaVeiculo,
    v.idCliente, cli.NomeCliente, cli.CpfCnpj,
    v.idResponsavel, r.NomeResponsavel,
    v.idVistoriador, fv.NomeFuncionario AS NomeVistoriador,
    v.idServico, s.DescricaoServico,
    v.ValorUnitarioServico, v.QuantidadeServico, v.ValorTotalServico,
    v.TotalParcelas, v.DataPrimeiraParcela,
    v.idPrimeiroTipoPagamento, tp.TipoPagamento AS DescricaoTipoPagamento,
    v.idStatusVistoria, v.SaldoDevedor, v.idContaReceber,
    v.Observacao, v.idUsuarioEmissao, v.idUsuarioAlteracao, v.DataAlteracao
  FROM Vistoria v
  LEFT JOIN Cliente cli ON cli.idCliente = v.idCliente
  LEFT JOIN Responsavel r ON r.idResponsavel = v.idResponsavel
  LEFT JOIN Funcionario fv ON fv.IdFuncionario = v.idVistoriador
  LEFT JOIN Servico s ON s.idServico = v.idServico
  LEFT JOIN TipoPagamento tp ON tp.idTipoPagamento = v.idPrimeiroTipoPagamento
`;

// Parcelas de Vistoria não têm tabela própria: são as próprias ContaReceberParcela geradas
// pela Manter_Vistoria (via v.idContaReceber) - ver [[project-contareceber-modulo]].
const SELECT_PARCELAS = `
  SELECT
    p.IdContaReceberParcela, p.IdContaReceber, p.NumeroParcela,
    p.ValorParcela, p.ValorDesconto, p.ValorJuros, p.ValorMulta, p.ValorPago,
    p.DataVencimento, p.DataPagamento, p.IdStatusParcela,
    p.IdTipoPagamento, tp.TipoPagamento AS DescricaoTipoPagamento,
    p.Observacao
  FROM ContaReceberParcela p
  LEFT JOIN TipoPagamento tp ON tp.idTipoPagamento = p.IdTipoPagamento
  WHERE p.IdContaReceber = @idContaReceber
  ORDER BY p.NumeroParcela
`;

interface ParametrosManterVistoria {
  acao: "I" | "A" | "D";
  idVistoria?: number | null;
  dataEmissao?: Date | null;
  placaVeiculo?: string | null;
  idCliente?: number | null;
  idResponsavel?: number | null;
  idVistoriador?: number | null;
  idServico?: number | null;
  valorUnitarioServico?: number | null;
  quantidadeServico?: number | null;
  valorTotalServico?: number | null;
  totalParcelas?: number | null;
  dataPrimeiraParcela?: Date | null;
  idPrimeiroTipoPagamento?: number | null;
  idUsuarioEmissao?: number | null;
  idUsuarioAlteracao?: number | null;
  idStatusVistoria?: number | null;
  saldoDevedor?: number | null;
  observacao?: string | null;
}

// Chama a stored procedure legada Manter_Vistoria (INSERT/UPDATE/DELETE transacional do
// cabeçalho). No INSERT, a procedure também cria o ContaReceber + parcelas (quando a
// vistoria não é paga integralmente na emissão) e o movimento de Caixa correspondente -
// regras completas vivem na procedure, não aqui. No UPDATE (acao='A'), só o cabeçalho de
// Vistoria é alterado (não mexe em ContaReceber/parcelas/caixa).
async function chamarManterVistoria(
  pool: Awaited<ReturnType<typeof getPool>>,
  params: ParametrosManterVistoria
): Promise<number | undefined> {
  const request = pool
    .request()
    .input("acao", sql.Char(1), params.acao)
    .input("idVistoria", sql.Int, params.idVistoria ?? null)
    .input("DataEmissao", sql.Date, params.dataEmissao ?? null)
    .input("PlacaVeiculo", sql.VarChar(7), params.placaVeiculo ?? null)
    .input("idCliente", sql.Int, params.idCliente ?? null)
    .input("idResponsavel", sql.Int, params.idResponsavel ?? null)
    .input("idVistoriador", sql.Int, params.idVistoriador ?? null)
    .input("idServico", sql.Int, params.idServico ?? null)
    .input("ValorUnitarioServico", sql.Money, params.valorUnitarioServico ?? null)
    .input("QuantidadeServico", sql.Int, params.quantidadeServico ?? null)
    .input("ValorTotalServico", sql.Money, params.valorTotalServico ?? null)
    .input("TotalParcelas", sql.SmallInt, params.totalParcelas ?? null)
    .input("DataPrimeiraParcela", sql.Date, params.dataPrimeiraParcela ?? null)
    .input("idPrimeiroTipoPagamento", sql.Int, params.idPrimeiroTipoPagamento ?? null)
    .input("idCategoria", sql.Int, null) // a procedure ignora/fixa em 7 (Recebimento de Cliente)
    .input("IntervaloMeses", sql.SmallInt, 1) // não exposto na UI - vencimento sempre mensal
    // No INSERT a procedure calcula o saldo sozinha (ignora este parâmetro); no UPDATE ela
    // grava @SaldoDevedor direto na coluna sem COALESCE - por isso o UPDATE precisa mandar o
    // valor atual do banco (ver rota PUT), nunca null, senão zera o saldo devedor real.
    .input("SaldoDevedor", sql.Money, params.saldoDevedor ?? null)
    .input("idUsuarioEmissao", sql.Int, params.idUsuarioEmissao ?? null)
    .input("idUsuarioAlteracao", sql.Int, params.idUsuarioAlteracao ?? null)
    .input("idStatusVistoria", sql.Int, params.idStatusVistoria ?? null)
    .input("Observacao", sql.VarChar(sql.MAX), params.observacao ?? null);

  const result = await request.execute("Manter_Vistoria");
  return result.recordset?.[0]?.IDNovo;
}

// GET /vistoria?busca=&status= - lista com filtros
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const status = (req.query.status as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("(v.PlacaVeiculo LIKE @busca OR cli.NomeCliente LIKE @busca OR cli.CpfCnpj LIKE @busca)");
    }
    if (status !== undefined && status !== "" && !Number.isNaN(Number(status))) {
      request.input("status", sql.Int, Number(status));
      condicoes.push("v.idStatusVistoria = @status");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY v.idVistoria DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar vistorias" });
  }
});

// GET /vistoria/:id - cabeçalho + parcelas (para edição/visualização)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const cabecalho = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE v.idVistoria = @id`);

    const vistoria = cabecalho.recordset[0];
    if (!vistoria) return res.status(404).json({ erro: "Vistoria não encontrada" });

    const parcelas = vistoria.idContaReceber
      ? (await pool.request().input("idContaReceber", sql.Int, vistoria.idContaReceber).query(SELECT_PARCELAS))
          .recordset
      : [];

    res.json({ ...vistoria, parcelas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar vistoria" });
  }
});

// POST /vistoria - lança uma vistoria (gera parcelas/ContaReceber/movimento de caixa
// automaticamente via Manter_Vistoria @acao='I', conforme as regras da procedure)
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const {
    dataEmissao,
    placaVeiculo,
    idCliente,
    idResponsavel,
    idVistoriador,
    idServico,
    valorUnitarioServico,
    quantidadeServico,
    valorTotalServico,
    totalParcelas,
    dataPrimeiraParcela,
    idPrimeiroTipoPagamento,
    observacao,
  } = req.body;

  if (!dataEmissao || !placaVeiculo || !idCliente || !idServico || !valorTotalServico) {
    return res
      .status(400)
      .json({ erro: "dataEmissao, placaVeiculo, idCliente, idServico e valorTotalServico são obrigatórios" });
  }
  if (valorTotalServico <= 0) return res.status(400).json({ erro: "valorTotalServico deve ser maior que zero" });
  if (totalParcelas !== undefined && totalParcelas < 1) {
    return res.status(400).json({ erro: "totalParcelas deve ser maior que zero" });
  }

  try {
    const pool = await getPool();

    const idVistoria = await chamarManterVistoria(pool, {
      acao: "I",
      dataEmissao: parseDataLocal(dataEmissao),
      placaVeiculo,
      idCliente,
      idResponsavel: idResponsavel || null,
      idVistoriador: idVistoriador || null,
      idServico,
      valorUnitarioServico: valorUnitarioServico ?? null,
      quantidadeServico: quantidadeServico ?? 1,
      valorTotalServico,
      totalParcelas: totalParcelas || 1,
      dataPrimeiraParcela: dataPrimeiraParcela ? parseDataLocal(dataPrimeiraParcela) : null,
      idPrimeiroTipoPagamento: idPrimeiroTipoPagamento || null,
      idUsuarioEmissao: req.user!.id,
      observacao: observacao || null,
    });

    res.status(201).json({ idVistoria });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao lançar vistoria" });
  }
});

// PUT /vistoria/:id - edita o cabeçalho (Manter_Vistoria @acao='A'). A procedure não recria
// ContaReceber/parcelas nem mexe em caixa nesse fluxo - o form trava os campos que definem o
// cronograma de pagamento depois que a vistoria é criada, para não desalinhar os dados.
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const {
    dataEmissao,
    placaVeiculo,
    idCliente,
    idResponsavel,
    idVistoriador,
    idServico,
    valorUnitarioServico,
    quantidadeServico,
    valorTotalServico,
    totalParcelas,
    dataPrimeiraParcela,
    idPrimeiroTipoPagamento,
    idStatusVistoria,
    observacao,
  } = req.body;

  if (!dataEmissao || !placaVeiculo || !idCliente || !idServico || !valorTotalServico) {
    return res
      .status(400)
      .json({ erro: "dataEmissao, placaVeiculo, idCliente, idServico e valorTotalServico são obrigatórios" });
  }
  if (valorTotalServico <= 0) return res.status(400).json({ erro: "valorTotalServico deve ser maior que zero" });

  try {
    const pool = await getPool();

    const atual = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT idUsuarioEmissao, SaldoDevedor, idStatusVistoria FROM Vistoria WHERE idVistoria = @id");
    if (atual.recordset.length === 0) {
      return res.status(404).json({ erro: "Vistoria não encontrada" });
    }

    await chamarManterVistoria(pool, {
      acao: "A",
      idVistoria: Number(req.params.id),
      dataEmissao: parseDataLocal(dataEmissao),
      placaVeiculo,
      idCliente,
      idResponsavel: idResponsavel || null,
      idVistoriador: idVistoriador || null,
      idServico,
      valorUnitarioServico: valorUnitarioServico ?? null,
      quantidadeServico: quantidadeServico ?? 1,
      valorTotalServico,
      totalParcelas: totalParcelas || 1,
      dataPrimeiraParcela: dataPrimeiraParcela ? parseDataLocal(dataPrimeiraParcela) : null,
      idPrimeiroTipoPagamento: idPrimeiroTipoPagamento || null,
      idUsuarioEmissao: atual.recordset[0].idUsuarioEmissao,
      idUsuarioAlteracao: req.user!.id,
      idStatusVistoria: idStatusVistoria ?? atual.recordset[0].idStatusVistoria,
      saldoDevedor: atual.recordset[0].SaldoDevedor,
      observacao: observacao || null,
    });

    res.json({ mensagem: "Vistoria atualizada" });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao atualizar vistoria" });
  }
});

// DELETE /vistoria/:id - exclusão definitiva do cabeçalho (Manter_Vistoria @acao='D').
// Não faz cascade em ContaReceber/parcelas (mesmo comportamento real da procedure).
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    await chamarManterVistoria(pool, { acao: "D", idVistoria: Number(req.params.id) });
    res.json({ mensagem: "Vistoria excluída" });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao excluir vistoria" });
  }
});

export default router;
