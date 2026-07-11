import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SELECT_BASE = `
  SELECT f.idFuncao, f.descricao
  FROM Funcao f
`;

// GET /funcao?busca= - lista com filtro por descrição
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("f.descricao LIKE @busca");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY f.idFuncao DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar funções" });
  }
});

// GET /funcao/:id - uma função (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE f.idFuncao = @id`);

    const funcao = result.recordset[0];
    if (!funcao) return res.status(404).json({ erro: "Função não encontrada" });
    res.json(funcao);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar função" });
  }
});

// POST /funcao - cria uma nova função
router.post("/", authMiddleware, async (req, res) => {
  const { descricao } = req.body;

  if (!descricao) {
    return res.status(400).json({ erro: "descricao é obrigatória" });
  }

  try {
    const pool = await getPool();

    // idFuncao não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    await pool
      .request()
      .input("descricao", sql.VarChar, descricao)
      .query(
        `INSERT INTO Funcao (idFuncao, descricao)
         VALUES ((SELECT ISNULL(MAX(idFuncao), 0) + 1 FROM Funcao), @descricao)`
      );

    res.status(201).json({ mensagem: "Função criada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar função" });
  }
});

// PUT /funcao/:id - edita uma função
router.put("/:id", authMiddleware, async (req, res) => {
  const { descricao } = req.body;

  if (!descricao) {
    return res.status(400).json({ erro: "descricao é obrigatória" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("descricao", sql.VarChar, descricao)
      .query("UPDATE Funcao SET descricao = @descricao WHERE idFuncao = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Função não encontrada" });
    }
    res.json({ mensagem: "Função atualizada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar função" });
  }
});

// DELETE /funcao/:id - exclusão definitiva (tabela sem coluna de status).
// O banco legado não tem FK real entre Funcionario.idFuncao e Funcao.idFuncao, então o
// vínculo é checado aqui na aplicação antes de excluir (ver [[project-exclusao-verifica-vinculo]]).
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const emUso = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 IdFuncionario FROM Funcionario WHERE idFuncao = @id");
    if (emUso.recordset.length > 0) {
      return res.status(409).json({ erro: "Não é possível excluir: existem funcionários vinculados a esta função" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Funcao WHERE idFuncao = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Função não encontrada" });
    }
    res.json({ mensagem: "Função excluída" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir função" });
  }
});

export default router;
