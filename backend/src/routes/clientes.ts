import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";
import { validarCPF, validarCNPJ } from "../utils/documento";

const router = Router();

const SELECT_BASE = `
  SELECT c.idCliente, c.NomeCliente, c.TipoPessoa, c.CpfCnpj, c.TipoCliente, c.Observacao
  FROM Cliente c
`;

// GET /clientes?busca=&tipoPessoa= - lista com filtro por nome, CPF/CNPJ e tipo de pessoa
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const tipoPessoa = (req.query.tipoPessoa as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("(c.NomeCliente LIKE @busca OR c.CpfCnpj LIKE @busca)");
    }
    if (tipoPessoa === "F" || tipoPessoa === "J") {
      request.input("tipoPessoa", sql.Char, tipoPessoa);
      condicoes.push("c.TipoPessoa = @tipoPessoa");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY c.idCliente DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar clientes" });
  }
});

// GET /clientes/:id - um cliente (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE c.idCliente = @id`);

    const cliente = result.recordset[0];
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });
    res.json(cliente);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar cliente" });
  }
});

// POST /clientes - cria um novo cliente
router.post("/", authMiddleware, async (req, res) => {
  const { nomeCliente, tipoPessoa, cpfCnpj, tipoCliente, observacao } = req.body;

  if (!nomeCliente || !tipoPessoa || !cpfCnpj) {
    return res.status(400).json({ erro: "nomeCliente, tipoPessoa e cpfCnpj são obrigatórios" });
  }
  if (tipoPessoa !== "F" && tipoPessoa !== "J") {
    return res.status(400).json({ erro: "tipoPessoa deve ser F ou J" });
  }
  if (tipoPessoa === "F" && !validarCPF(cpfCnpj)) {
    return res.status(400).json({ erro: "CPF inválido" });
  }
  if (tipoPessoa === "J" && !validarCNPJ(cpfCnpj)) {
    return res.status(400).json({ erro: "CNPJ inválido" });
  }

  try {
    const pool = await getPool();

    // idCliente não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    const inserted = await pool
      .request()
      .input("nomeCliente", sql.VarChar, nomeCliente)
      .input("tipoPessoa", sql.Char, tipoPessoa)
      .input("cpfCnpj", sql.VarChar, cpfCnpj)
      .input("tipoCliente", sql.VarChar, tipoCliente || "")
      .input("observacao", sql.Text, observacao || null)
      .query(
        `INSERT INTO Cliente (idCliente, NomeCliente, TipoPessoa, CpfCnpj, TipoCliente, Observacao)
         OUTPUT INSERTED.idCliente
         VALUES ((SELECT ISNULL(MAX(idCliente), 0) + 1 FROM Cliente), @nomeCliente, @tipoPessoa,
                 @cpfCnpj, @tipoCliente, @observacao)`
      );

    res.status(201).json({ mensagem: "Cliente criado", idCliente: inserted.recordset[0].idCliente });
  } catch (err: any) {
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({ erro: "Já existe um cliente cadastrado com este CPF/CNPJ" });
    }
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar cliente" });
  }
});

// PUT /clientes/:id - edita um cliente
router.put("/:id", authMiddleware, async (req, res) => {
  const { nomeCliente, tipoPessoa, cpfCnpj, tipoCliente, observacao } = req.body;

  if (!nomeCliente || !tipoPessoa || !cpfCnpj) {
    return res.status(400).json({ erro: "nomeCliente, tipoPessoa e cpfCnpj são obrigatórios" });
  }
  if (tipoPessoa !== "F" && tipoPessoa !== "J") {
    return res.status(400).json({ erro: "tipoPessoa deve ser F ou J" });
  }
  if (tipoPessoa === "F" && !validarCPF(cpfCnpj)) {
    return res.status(400).json({ erro: "CPF inválido" });
  }
  if (tipoPessoa === "J" && !validarCNPJ(cpfCnpj)) {
    return res.status(400).json({ erro: "CNPJ inválido" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("nomeCliente", sql.VarChar, nomeCliente)
      .input("tipoPessoa", sql.Char, tipoPessoa)
      .input("cpfCnpj", sql.VarChar, cpfCnpj)
      .input("tipoCliente", sql.VarChar, tipoCliente || "")
      .input("observacao", sql.Text, observacao || null)
      .query(
        `UPDATE Cliente
         SET NomeCliente = @nomeCliente, TipoPessoa = @tipoPessoa, CpfCnpj = @cpfCnpj,
             TipoCliente = @tipoCliente, Observacao = @observacao
         WHERE idCliente = @id`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Cliente não encontrado" });
    }
    res.json({ mensagem: "Cliente atualizado" });
  } catch (err: any) {
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({ erro: "Já existe um cliente cadastrado com este CPF/CNPJ" });
    }
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar cliente" });
  }
});

// DELETE /clientes/:id - exclusão definitiva (tabela sem coluna de status).
// O banco legado não tem FK real entre Vistoria/ContaReceber/Responsavel.idCliente e Cliente.idCliente,
// então o vínculo é checado aqui na aplicação antes de excluir (ver [[project-exclusao-verifica-vinculo]]).
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const emUsoVistoria = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 idCliente FROM Vistoria WHERE idCliente = @id");
    const emUsoContaReceber = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 idCliente FROM ContaReceber WHERE idCliente = @id");
    const emUsoResponsavel = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 idCliente FROM Responsavel WHERE idCliente = @id");
    if (
      emUsoVistoria.recordset.length > 0 ||
      emUsoContaReceber.recordset.length > 0 ||
      emUsoResponsavel.recordset.length > 0
    ) {
      return res
        .status(409)
        .json({ erro: "Não é possível excluir: existem vistorias, contas a receber ou responsáveis vinculados a este cliente" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Cliente WHERE idCliente = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Cliente não encontrado" });
    }
    res.json({ mensagem: "Cliente excluído" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir cliente" });
  }
});

export default router;
