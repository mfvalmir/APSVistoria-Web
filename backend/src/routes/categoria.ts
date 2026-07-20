import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SELECT_BASE = `
  SELECT c.IdCategoria, c.DescricaoCategoria
  FROM Categoria c
`;

// GET /categoria?busca= - lista com filtro por descrição
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("c.DescricaoCategoria LIKE @busca");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY c.IdCategoria DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar categorias" });
  }
});

// GET /categoria/:id - uma categoria (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE c.IdCategoria = @id`);

    const categoria = result.recordset[0];
    if (!categoria) return res.status(404).json({ erro: "Categoria não encontrada" });
    res.json(categoria);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar categoria" });
  }
});

// POST /categoria - cria uma nova categoria
router.post("/", authMiddleware, async (req, res) => {
  const { descricaoCategoria } = req.body;

  if (!descricaoCategoria) {
    return res.status(400).json({ erro: "descricaoCategoria é obrigatória" });
  }

  try {
    const pool = await getPool();

    // IdCategoria não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    const result = await pool
      .request()
      .input("descricaoCategoria", sql.VarChar, descricaoCategoria)
      .query(
        `INSERT INTO Categoria (IdCategoria, DescricaoCategoria)
         OUTPUT INSERTED.IdCategoria
         VALUES ((SELECT ISNULL(MAX(IdCategoria), 0) + 1 FROM Categoria), @descricaoCategoria)`
      );

    res.status(201).json({ IdCategoria: result.recordset[0].IdCategoria, mensagem: "Categoria criada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar categoria" });
  }
});

// PUT /categoria/:id - edita uma categoria
router.put("/:id", authMiddleware, async (req, res) => {
  const { descricaoCategoria } = req.body;

  if (!descricaoCategoria) {
    return res.status(400).json({ erro: "descricaoCategoria é obrigatória" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("descricaoCategoria", sql.VarChar, descricaoCategoria)
      .query("UPDATE Categoria SET DescricaoCategoria = @descricaoCategoria WHERE IdCategoria = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Categoria não encontrada" });
    }
    res.json({ mensagem: "Categoria atualizada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar categoria" });
  }
});

// DELETE /categoria/:id - exclusão definitiva (tabela sem coluna de status).
// O banco legado não tem FK real entre ContaPagar/ContaReceber.idCategoria e Categoria.IdCategoria,
// então o vínculo é checado aqui na aplicação antes de excluir (ver [[project-exclusao-verifica-vinculo]]).
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const emUsoPagar = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 idCategoria FROM ContaPagar WHERE idCategoria = @id");
    const emUsoReceber = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 idCategoria FROM ContaReceber WHERE idCategoria = @id");
    if (emUsoPagar.recordset.length > 0 || emUsoReceber.recordset.length > 0) {
      return res
        .status(409)
        .json({ erro: "Não é possível excluir: existem contas a pagar/receber vinculadas a esta categoria" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Categoria WHERE IdCategoria = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Categoria não encontrada" });
    }
    res.json({ mensagem: "Categoria excluída" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir categoria" });
  }
});

export default router;
