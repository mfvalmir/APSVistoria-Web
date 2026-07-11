import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SELECT_BASE = `
  SELECT b.idBanco, b.DescricaoBanco
  FROM Banco b
`;

// GET /banco?busca= - lista com filtro por descrição
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("b.DescricaoBanco LIKE @busca");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY b.idBanco DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar bancos" });
  }
});

// GET /banco/:id - um banco (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE b.idBanco = @id`);

    const banco = result.recordset[0];
    if (!banco) return res.status(404).json({ erro: "Banco não encontrado" });
    res.json(banco);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar banco" });
  }
});

// POST /banco - cria um novo banco
router.post("/", authMiddleware, async (req, res) => {
  const { descricaoBanco } = req.body;

  if (!descricaoBanco) {
    return res.status(400).json({ erro: "descricaoBanco é obrigatória" });
  }

  try {
    const pool = await getPool();

    // idBanco não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    await pool
      .request()
      .input("descricaoBanco", sql.VarChar, descricaoBanco)
      .query(
        `INSERT INTO Banco (idBanco, DescricaoBanco)
         VALUES ((SELECT ISNULL(MAX(idBanco), 0) + 1 FROM Banco), @descricaoBanco)`
      );

    res.status(201).json({ mensagem: "Banco criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar banco" });
  }
});

// PUT /banco/:id - edita um banco
router.put("/:id", authMiddleware, async (req, res) => {
  const { descricaoBanco } = req.body;

  if (!descricaoBanco) {
    return res.status(400).json({ erro: "descricaoBanco é obrigatória" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("descricaoBanco", sql.VarChar, descricaoBanco)
      .query("UPDATE Banco SET DescricaoBanco = @descricaoBanco WHERE idBanco = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Banco não encontrado" });
    }
    res.json({ mensagem: "Banco atualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar banco" });
  }
});

// DELETE /banco/:id - exclusão definitiva (tabela sem coluna de status).
// O banco legado não tem FK real entre Funcionario.IDBanco e Banco.idBanco, então o
// vínculo é checado aqui na aplicação antes de excluir (ver [[project-exclusao-verifica-vinculo]]).
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const emUso = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 IdFuncionario FROM Funcionario WHERE IDBanco = @id");
    if (emUso.recordset.length > 0) {
      return res.status(409).json({ erro: "Não é possível excluir: existem funcionários vinculados a este banco" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Banco WHERE idBanco = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Banco não encontrado" });
    }
    res.json({ mensagem: "Banco excluído" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir banco" });
  }
});

export default router;
