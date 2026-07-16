import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { parseDataLocal } from "../utils/data";

const router = Router();

const SELECT_BASE = `
  SELECT
    c.idCaixa, c.DataAbertura, c.SaldoInicial,
    c.idUsuarioAbertura, fa.NomeFuncionario AS NomeUsuarioAbertura,
    c.DataFechamento, c.SaldoFinal,
    c.idUsuarioFechamento, ff.NomeFuncionario AS NomeUsuarioFechamento,
    c.Observacao
  FROM Caixa c
  LEFT JOIN usuario ua ON ua.IDUser = c.idUsuarioAbertura
  LEFT JOIN Funcionario fa ON fa.IdFuncionario = ua.IDFuncionario
  LEFT JOIN usuario uf ON uf.IDUser = c.idUsuarioFechamento
  LEFT JOIN Funcionario ff ON ff.IdFuncionario = uf.IDFuncionario
`;

const SELECT_MOVIMENTOS = `
  SELECT
    m.idMovimento, m.idCaixa, m.DataHora, m.TipoMovimento,
    m.idFormaPagamento, tp.TipoPagamento AS DescricaoTipoPagamento,
    m.Valor, m.TipoOrigem, m.idOrigem, m.Descricao, m.idusuario
  FROM CaixaMovimento m
  LEFT JOIN TipoPagamento tp ON tp.idTipoPagamento = m.idFormaPagamento
  WHERE m.idCaixa = @id
  ORDER BY m.DataHora DESC
`;

interface ParametrosManterCaixa {
  acao: "O" | "A" | "F" | "D";
  idCaixa?: number | null;
  dataAbertura?: Date | null;
  saldoInicial?: number | null;
  idUsuarioAbertura?: number | null;
  dataFechamento?: Date | null;
  saldoFinal?: number | null;
  idUsuarioFechamento?: number | null;
  observacao?: string | null;
}

// Chama a stored procedure legada Manter_Caixa. @acao: 'O' abre um novo caixa (bloqueia se já
// houver um aberto), 'A' edita o cabeçalho de um caixa ainda aberto (bloqueia se já fechado),
// 'F' fecha o caixa (grava SaldoFinal/idUsuarioFechamento e acrescenta a Observacao, não
// sobrescreve), 'D' exclui o caixa e seus movimentos (bloqueia se já fechado).
async function chamarManterCaixa(
  pool: Awaited<ReturnType<typeof getPool>>,
  params: ParametrosManterCaixa
): Promise<number | undefined> {
  const request = pool
    .request()
    .input("acao", sql.Char(1), params.acao)
    .input("IdCaixa", sql.Int, params.idCaixa ?? null)
    .input("DataAbertura", sql.DateTime, params.dataAbertura ?? null)
    .input("SaldoInicial", sql.Decimal(18, 2), params.saldoInicial ?? null)
    .input("idUsuarioAbertura", sql.Int, params.idUsuarioAbertura ?? null)
    .input("DataFechamento", sql.DateTime, params.dataFechamento ?? null)
    .input("SaldoFinal", sql.Decimal(18, 2), params.saldoFinal ?? null)
    .input("idUsuarioFechamento", sql.Int, params.idUsuarioFechamento ?? null)
    .input("Observacao", sql.VarChar(sql.MAX), params.observacao ?? "");

  const result = await request.execute("Manter_Caixa");
  return result.recordset?.[0]?.IDNovo;
}

// GET /caixa?busca=&status=aberto|fechado|todos&dataInicial=&dataFinal= - lista com filtros
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const status = (req.query.status as string | undefined)?.trim() || "aberto";
  const dataInicial = (req.query.dataInicial as string | undefined)?.trim();
  const dataFinal = (req.query.dataFinal as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("(fa.NomeFuncionario LIKE @busca OR c.Observacao LIKE @busca)");
    }
    if (status === "aberto") {
      condicoes.push("c.DataFechamento IS NULL");
    } else if (status === "fechado") {
      condicoes.push("c.DataFechamento IS NOT NULL");
    }
    if (dataInicial) {
      request.input("dataInicial", sql.Date, dataInicial);
      condicoes.push("c.DataAbertura >= @dataInicial");
    }
    if (dataFinal) {
      request.input("dataFinal", sql.Date, dataFinal);
      condicoes.push("c.DataAbertura <= @dataFinal");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY c.idCaixa DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar caixas" });
  }
});

// GET /caixa/:id - cabeçalho + movimentos
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const cabecalho = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE c.idCaixa = @id`);

    const caixa = cabecalho.recordset[0];
    if (!caixa) return res.status(404).json({ erro: "Caixa não encontrado" });

    const movimentos = await pool.request().input("id", sql.Int, req.params.id).query(SELECT_MOVIMENTOS);

    res.json({ ...caixa, movimentos: movimentos.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar caixa" });
  }
});

// POST /caixa - abre um novo caixa (Manter_Caixa @acao='O')
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const { dataAbertura, saldoInicial, observacao } = req.body;

  try {
    const pool = await getPool();

    const idCaixa = await chamarManterCaixa(pool, {
      acao: "O",
      dataAbertura: dataAbertura ? parseDataLocal(dataAbertura) : null,
      saldoInicial: saldoInicial || 0,
      idUsuarioAbertura: req.user!.id,
      observacao: observacao || "",
    });

    res.status(201).json({ idCaixa });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao abrir caixa" });
  }
});

// PUT /caixa/:id - edita o cabeçalho de um caixa ainda aberto (Manter_Caixa @acao='A')
router.put("/:id", authMiddleware, async (req, res) => {
  const { dataAbertura, saldoInicial, observacao } = req.body;

  try {
    const pool = await getPool();

    // idUsuarioAbertura é preservado (a procedure sempre regrava essa coluna com o valor
    // recebido) - buscamos o valor atual em vez de deixar a edição roubar a autoria original.
    const atual = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT idUsuarioAbertura FROM Caixa WHERE idCaixa = @id");
    if (atual.recordset.length === 0) {
      return res.status(404).json({ erro: "Caixa não encontrado" });
    }

    await chamarManterCaixa(pool, {
      acao: "A",
      idCaixa: Number(req.params.id),
      dataAbertura: dataAbertura ? parseDataLocal(dataAbertura) : null,
      saldoInicial: saldoInicial || 0,
      idUsuarioAbertura: atual.recordset[0].idUsuarioAbertura,
      observacao: observacao || "",
    });

    res.json({ mensagem: "Caixa atualizado" });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao atualizar caixa" });
  }
});

// DELETE /caixa/:id - exclui o caixa (Manter_Caixa @acao='D', bloqueia se já fechado).
// A procedure legada, sozinha, cascateia e apaga os CaixaMovimento junto - mas isso destruiria
// o histórico de baixas/estornos de ContaPagar/ContaReceber/Vistoria vinculado a este caixa.
// Por isso a aplicação bloqueia a exclusão se já existir qualquer lançamento (ver
// [[project_exclusao_verifica_vinculo]]), em vez de deixar a procedure apagar tudo.
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const emUso = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 idMovimento FROM CaixaMovimento WHERE idCaixa = @id");
    if (emUso.recordset.length > 0) {
      return res
        .status(409)
        .json({ erro: "Não é possível excluir: existem lançamentos vinculados a este caixa" });
    }

    await chamarManterCaixa(pool, { acao: "D", idCaixa: Number(req.params.id) });
    res.json({ mensagem: "Caixa excluído" });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao excluir caixa" });
  }
});

// POST /caixa/:id/fechar - fecha o caixa (Manter_Caixa @acao='F')
router.post("/:id/fechar", authMiddleware, async (req: AuthRequest, res) => {
  const { dataFechamento, saldoFinal, observacao } = req.body;

  if (!dataFechamento) {
    return res.status(400).json({ erro: "dataFechamento é obrigatório" });
  }
  if (saldoFinal === undefined || saldoFinal === null) {
    return res.status(400).json({ erro: "saldoFinal é obrigatório" });
  }

  try {
    const pool = await getPool();

    // Manter_Caixa, no acao='F', concatena @Observacao no texto existente com " | " (sem
    // quebra de linha). O frontend já manda o texto final pronto (com carimbo de data/hora e
    // quebra de linha, no mesmo formato usado ao editar o caixa aberto - ver CaixaForm.tsx),
    // então aqui passamos null pra procedure não mexer em Observacao, e gravamos o texto
    // definitivo direto, numa instrução separada.
    await chamarManterCaixa(pool, {
      acao: "F",
      idCaixa: Number(req.params.id),
      dataFechamento: parseDataLocal(dataFechamento),
      saldoFinal,
      idUsuarioFechamento: req.user!.id,
      observacao: null,
    });

    if (observacao) {
      await pool
        .request()
        .input("id", sql.Int, req.params.id)
        .input("observacao", sql.VarChar(sql.MAX), observacao)
        .query("UPDATE Caixa SET Observacao = @observacao WHERE idCaixa = @id");
    }

    res.json({ mensagem: "Caixa fechado com sucesso" });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ erro: err.message || "Erro ao fechar caixa" });
  }
});

export default router;
