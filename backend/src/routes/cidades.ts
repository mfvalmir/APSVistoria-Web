import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SELECT_BASE = `
  SELECT c.idCidade, c.DescricaoCidade, c.UF
  FROM Cidade c
`;

// GET /cidades?busca= - lista com filtro por descrição ou UF
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("(c.DescricaoCidade LIKE @busca OR c.UF LIKE @busca)");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY c.idCidade DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar cidades" });
  }
});

// GET /cidades/:id - uma cidade (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE c.idCidade = @id`);

    const cidade = result.recordset[0];
    if (!cidade) return res.status(404).json({ erro: "Cidade não encontrada" });
    res.json(cidade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar cidade" });
  }
});

// POST /cidades - cria uma nova cidade
router.post("/", authMiddleware, async (req, res) => {
  const { descricaoCidade, uf } = req.body;

  if (!descricaoCidade || !uf) {
    return res.status(400).json({ erro: "descricaoCidade e uf são obrigatórios" });
  }

  try {
    const pool = await getPool();

    // idCidade não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    await pool
      .request()
      .input("descricaoCidade", sql.VarChar, descricaoCidade)
      .input("uf", sql.VarChar, uf.toUpperCase())
      .query(
        `INSERT INTO Cidade (idCidade, DescricaoCidade, UF)
         VALUES ((SELECT ISNULL(MAX(idCidade), 0) + 1 FROM Cidade), @descricaoCidade, @uf)`
      );

    res.status(201).json({ mensagem: "Cidade criada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar cidade" });
  }
});

// PUT /cidades/:id - edita uma cidade
router.put("/:id", authMiddleware, async (req, res) => {
  const { descricaoCidade, uf } = req.body;

  if (!descricaoCidade || !uf) {
    return res.status(400).json({ erro: "descricaoCidade e uf são obrigatórios" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("descricaoCidade", sql.VarChar, descricaoCidade)
      .input("uf", sql.VarChar, uf.toUpperCase())
      .query(
        `UPDATE Cidade
         SET DescricaoCidade = @descricaoCidade, UF = @uf
         WHERE idCidade = @id`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Cidade não encontrada" });
    }
    res.json({ mensagem: "Cidade atualizada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar cidade" });
  }
});

// DELETE /cidades/:id - exclusão definitiva (tabela sem coluna de status).
// O banco legado não tem FK real entre Bairro.idCidade e Cidade.idCidade, então o vínculo
// é checado aqui na aplicação antes de excluir (ver [[project-exclusao-verifica-vinculo]]).
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const emUso = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 IDBairro FROM Bairro WHERE idCidade = @id");
    if (emUso.recordset.length > 0) {
      return res.status(409).json({ erro: "Não é possível excluir: existem bairros vinculados a esta cidade" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Cidade WHERE idCidade = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Cidade não encontrada" });
    }
    res.json({ mensagem: "Cidade excluída" });
  } catch (err: any) {
    if (err?.number === 547) {
      return res.status(409).json({ erro: "Não é possível excluir: existem bairros vinculados a esta cidade" });
    }
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir cidade" });
  }
});

export default router;
