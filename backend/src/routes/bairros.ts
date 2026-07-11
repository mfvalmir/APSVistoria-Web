import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SELECT_BASE = `
  SELECT b.IDBairro, b.DescricaoBairro, b.idCidade, c.DescricaoCidade, c.UF
  FROM Bairro b
  LEFT JOIN Cidade c ON c.idCidade = b.idCidade
`;

// GET /bairros?busca= - lista com filtro por bairro ou cidade
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("(b.DescricaoBairro LIKE @busca OR c.DescricaoCidade LIKE @busca)");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY b.IDBairro DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar bairros" });
  }
});

// GET /bairros/:id - um bairro (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE b.IDBairro = @id`);

    const bairro = result.recordset[0];
    if (!bairro) return res.status(404).json({ erro: "Bairro não encontrado" });
    res.json(bairro);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar bairro" });
  }
});

// POST /bairros - cria um novo bairro
router.post("/", authMiddleware, async (req, res) => {
  const { descricaoBairro, idCidade } = req.body;

  if (!descricaoBairro || !idCidade) {
    return res.status(400).json({ erro: "descricaoBairro e idCidade são obrigatórios" });
  }

  try {
    const pool = await getPool();

    // IDBairro não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    await pool
      .request()
      .input("descricaoBairro", sql.VarChar, descricaoBairro)
      .input("idCidade", sql.Int, idCidade)
      .query(
        `INSERT INTO Bairro (IDBairro, DescricaoBairro, idCidade)
         VALUES ((SELECT ISNULL(MAX(IDBairro), 0) + 1 FROM Bairro), @descricaoBairro, @idCidade)`
      );

    res.status(201).json({ mensagem: "Bairro criado" });
  } catch (err: any) {
    if (err?.number === 547) {
      return res.status(400).json({ erro: "Cidade selecionada não existe" });
    }
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar bairro" });
  }
});

// PUT /bairros/:id - edita um bairro
router.put("/:id", authMiddleware, async (req, res) => {
  const { descricaoBairro, idCidade } = req.body;

  if (!descricaoBairro || !idCidade) {
    return res.status(400).json({ erro: "descricaoBairro e idCidade são obrigatórios" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("descricaoBairro", sql.VarChar, descricaoBairro)
      .input("idCidade", sql.Int, idCidade)
      .query(
        `UPDATE Bairro
         SET DescricaoBairro = @descricaoBairro, idCidade = @idCidade
         WHERE IDBairro = @id`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Bairro não encontrado" });
    }
    res.json({ mensagem: "Bairro atualizado" });
  } catch (err: any) {
    if (err?.number === 547) {
      return res.status(400).json({ erro: "Cidade selecionada não existe" });
    }
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar bairro" });
  }
});

// DELETE /bairros/:id - exclusão definitiva (tabela sem coluna de status).
// O banco legado não tem FK real entre Funcionario.idBairro e Bairro.IDBairro, então o vínculo
// é checado aqui na aplicação antes de excluir (ver [[project-exclusao-verifica-vinculo]]).
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const emUso = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 IdFuncionario FROM Funcionario WHERE idBairro = @id");
    if (emUso.recordset.length > 0) {
      return res.status(409).json({ erro: "Não é possível excluir: existem funcionários vinculados a este bairro" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Bairro WHERE IDBairro = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Bairro não encontrado" });
    }
    res.json({ mensagem: "Bairro excluído" });
  } catch (err: any) {
    if (err?.number === 547) {
      return res.status(409).json({ erro: "Não é possível excluir: existem funcionários vinculados a este bairro" });
    }
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir bairro" });
  }
});

export default router;
