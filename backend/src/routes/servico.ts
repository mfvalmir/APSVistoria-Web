import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SELECT_BASE = `
  SELECT s.idServico, s.DescricaoServico, s.ValorServico, s.Situacao
  FROM Servico s
`;

// GET /servico?busca=&status= - lista com filtros
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const status = (req.query.status as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("s.DescricaoServico LIKE @busca");
    }
    if (status === "A" || status === "I") {
      request.input("status", sql.NChar, status);
      condicoes.push("LTRIM(RTRIM(s.Situacao)) = @status");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY s.idServico DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar serviços" });
  }
});

// GET /servico/:id - um serviço (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE s.idServico = @id`);

    const servico = result.recordset[0];
    if (!servico) return res.status(404).json({ erro: "Serviço não encontrado" });
    res.json(servico);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar serviço" });
  }
});

// POST /servico - cria um novo serviço
router.post("/", authMiddleware, async (req, res) => {
  const { descricaoServico, valorServico } = req.body;

  if (!descricaoServico) {
    return res.status(400).json({ erro: "descricaoServico é obrigatória" });
  }
  if (valorServico === undefined || valorServico === null || valorServico === "") {
    return res.status(400).json({ erro: "valorServico é obrigatório" });
  }

  try {
    const pool = await getPool();

    // idServico não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    const result = await pool
      .request()
      .input("descricaoServico", sql.VarChar, descricaoServico)
      .input("valorServico", sql.Money, valorServico)
      .query(
        `INSERT INTO Servico (idServico, DescricaoServico, ValorServico, Situacao)
         OUTPUT INSERTED.idServico
         VALUES ((SELECT ISNULL(MAX(idServico), 0) + 1 FROM Servico), @descricaoServico, @valorServico, 'A')`
      );

    res.status(201).json({ idServico: result.recordset[0].idServico, mensagem: "Serviço criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar serviço" });
  }
});

// PUT /servico/:id - edita um serviço
router.put("/:id", authMiddleware, async (req, res) => {
  const { descricaoServico, valorServico, situacao } = req.body;

  if (!descricaoServico || !situacao) {
    return res.status(400).json({ erro: "descricaoServico e situacao são obrigatórios" });
  }
  if (valorServico === undefined || valorServico === null || valorServico === "") {
    return res.status(400).json({ erro: "valorServico é obrigatório" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("descricaoServico", sql.VarChar, descricaoServico)
      .input("valorServico", sql.Money, valorServico)
      .input("situacao", sql.NChar, situacao)
      .query(
        `UPDATE Servico
         SET DescricaoServico = @descricaoServico, ValorServico = @valorServico, Situacao = @situacao
         WHERE idServico = @id`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado" });
    }
    res.json({ mensagem: "Serviço atualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar serviço" });
  }
});

// DELETE /servico/:id - desativa (soft delete), preserva vínculo com Vistoria.idServico
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE Servico SET Situacao = 'I' WHERE idServico = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado" });
    }
    res.json({ mensagem: "Serviço desativado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao desativar serviço" });
  }
});

export default router;
