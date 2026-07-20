import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SELECT_BASE = `
  SELECT t.idTipoPagamento, t.TipoPagamento AS DescricaoTipoPagamento
  FROM TipoPagamento t
`;

// GET /tipo-pagamento?busca= - lista com filtro por descrição
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("t.TipoPagamento LIKE @busca");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY t.idTipoPagamento DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar tipos de pagamento" });
  }
});

// GET /tipo-pagamento/:id - um tipo de pagamento (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE t.idTipoPagamento = @id`);

    const tipoPagamento = result.recordset[0];
    if (!tipoPagamento) return res.status(404).json({ erro: "Tipo de pagamento não encontrado" });
    res.json(tipoPagamento);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar tipo de pagamento" });
  }
});

// POST /tipo-pagamento - cria um novo tipo de pagamento
router.post("/", authMiddleware, async (req, res) => {
  const { descricaoTipoPagamento } = req.body;

  if (!descricaoTipoPagamento) {
    return res.status(400).json({ erro: "descricaoTipoPagamento é obrigatória" });
  }

  try {
    const pool = await getPool();

    // idTipoPagamento não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    const result = await pool
      .request()
      .input("descricaoTipoPagamento", sql.VarChar, descricaoTipoPagamento)
      .query(
        `INSERT INTO TipoPagamento (idTipoPagamento, TipoPagamento)
         OUTPUT INSERTED.idTipoPagamento
         VALUES ((SELECT ISNULL(MAX(idTipoPagamento), 0) + 1 FROM TipoPagamento), @descricaoTipoPagamento)`
      );

    res.status(201).json({ idTipoPagamento: result.recordset[0].idTipoPagamento, mensagem: "Tipo de pagamento criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar tipo de pagamento" });
  }
});

// PUT /tipo-pagamento/:id - edita um tipo de pagamento
router.put("/:id", authMiddleware, async (req, res) => {
  const { descricaoTipoPagamento } = req.body;

  if (!descricaoTipoPagamento) {
    return res.status(400).json({ erro: "descricaoTipoPagamento é obrigatória" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("descricaoTipoPagamento", sql.VarChar, descricaoTipoPagamento)
      .query("UPDATE TipoPagamento SET TipoPagamento = @descricaoTipoPagamento WHERE idTipoPagamento = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Tipo de pagamento não encontrado" });
    }
    res.json({ mensagem: "Tipo de pagamento atualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar tipo de pagamento" });
  }
});

// DELETE /tipo-pagamento/:id - exclusão definitiva (tabela sem coluna de status).
// O banco legado não tem FK real entre ContaPagar/ContaPagarParcela/ContaReceber/ContaReceberParcela/
// Vistoria/CaixaMovimento e TipoPagamento.idTipoPagamento, então o vínculo é checado aqui na
// aplicação antes de excluir (ver [[project-exclusao-verifica-vinculo]]).
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const tabelasVinculadas = [
      { tabela: "ContaPagar", coluna: "IdPrimeiroTipoPagamento" },
      { tabela: "ContaPagarParcela", coluna: "IdTipoPagamento" },
      { tabela: "ContaReceber", coluna: "IdPrimeiroTipoPagamento" },
      { tabela: "ContaReceberParcela", coluna: "idTipoPagamento" },
      { tabela: "Vistoria", coluna: "idPrimeiroTipoPagamento" },
      { tabela: "CaixaMovimento", coluna: "idFormaPagamento" },
    ];

    for (const { tabela, coluna } of tabelasVinculadas) {
      const emUso = await pool
        .request()
        .input("id", sql.Int, req.params.id)
        .query(`SELECT TOP 1 ${coluna} FROM ${tabela} WHERE ${coluna} = @id`);
      if (emUso.recordset.length > 0) {
        return res
          .status(409)
          .json({ erro: "Não é possível excluir: existem registros vinculados a este tipo de pagamento" });
      }
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM TipoPagamento WHERE idTipoPagamento = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Tipo de pagamento não encontrado" });
    }
    res.json({ mensagem: "Tipo de pagamento excluído" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir tipo de pagamento" });
  }
});

export default router;
