import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";
import { validarCPF, validarCNPJ } from "../utils/documento";

const router = Router();

const SELECT_BASE = `
  SELECT f.idFornecedor, f.RazaoSocial, f.NomeFantasia, f.CpfCnpj, f.Telefone, f.Email, f.Observacao, f.Ativo
  FROM Fornecedor f
`;

// CpfCnpj é opcional (nullable no legado); quando informado, o tipo é inferido pela
// quantidade de dígitos (11 = CPF, 14 = CNPJ) já que Fornecedor não tem coluna TipoPessoa.
function cpfCnpjValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 11) return validarCPF(digitos);
  if (digitos.length === 14) return validarCNPJ(digitos);
  return false;
}

// GET /fornecedores?busca=&status= - lista com filtros
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const status = (req.query.status as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("(f.RazaoSocial LIKE @busca OR f.NomeFantasia LIKE @busca OR f.CpfCnpj LIKE @busca)");
    }
    if (status === "A" || status === "I") {
      request.input("status", sql.VarChar, status);
      condicoes.push("LTRIM(RTRIM(f.Ativo)) = @status");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY f.idFornecedor DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar fornecedores" });
  }
});

// GET /fornecedores/:id - um fornecedor (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE f.idFornecedor = @id`);

    const fornecedor = result.recordset[0];
    if (!fornecedor) return res.status(404).json({ erro: "Fornecedor não encontrado" });
    res.json(fornecedor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar fornecedor" });
  }
});

// POST /fornecedores - cria um novo fornecedor
router.post("/", authMiddleware, async (req, res) => {
  const { razaoSocial, nomeFantasia, cpfCnpj, telefone, email, observacao } = req.body;

  if (!razaoSocial) {
    return res.status(400).json({ erro: "razaoSocial é obrigatória" });
  }
  if (cpfCnpj && !cpfCnpjValido(cpfCnpj)) {
    return res.status(400).json({ erro: "CPF/CNPJ inválido" });
  }

  try {
    const pool = await getPool();

    // idFornecedor não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    const result = await pool
      .request()
      .input("razaoSocial", sql.VarChar, razaoSocial)
      .input("nomeFantasia", sql.VarChar, nomeFantasia || null)
      .input("cpfCnpj", sql.VarChar, cpfCnpj ? cpfCnpj.replace(/\D/g, "") : null)
      .input("telefone", sql.VarChar, telefone || null)
      .input("email", sql.VarChar, email || null)
      .input("observacao", sql.Text, observacao || null)
      .query(
        `INSERT INTO Fornecedor (idFornecedor, RazaoSocial, NomeFantasia, CpfCnpj, Telefone, Email, Observacao, Ativo)
         OUTPUT INSERTED.idFornecedor
         VALUES ((SELECT ISNULL(MAX(idFornecedor), 0) + 1 FROM Fornecedor), @razaoSocial, @nomeFantasia,
                 @cpfCnpj, @telefone, @email, @observacao, 'A')`
      );

    res.status(201).json({ idFornecedor: result.recordset[0].idFornecedor, mensagem: "Fornecedor criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar fornecedor" });
  }
});

// PUT /fornecedores/:id - edita um fornecedor
router.put("/:id", authMiddleware, async (req, res) => {
  const { razaoSocial, nomeFantasia, cpfCnpj, telefone, email, observacao, ativo } = req.body;

  if (!razaoSocial || !ativo) {
    return res.status(400).json({ erro: "razaoSocial e ativo são obrigatórios" });
  }
  if (cpfCnpj && !cpfCnpjValido(cpfCnpj)) {
    return res.status(400).json({ erro: "CPF/CNPJ inválido" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("razaoSocial", sql.VarChar, razaoSocial)
      .input("nomeFantasia", sql.VarChar, nomeFantasia || null)
      .input("cpfCnpj", sql.VarChar, cpfCnpj ? cpfCnpj.replace(/\D/g, "") : null)
      .input("telefone", sql.VarChar, telefone || null)
      .input("email", sql.VarChar, email || null)
      .input("observacao", sql.Text, observacao || null)
      .input("ativo", sql.VarChar, ativo)
      .query(
        `UPDATE Fornecedor
         SET RazaoSocial = @razaoSocial, NomeFantasia = @nomeFantasia, CpfCnpj = @cpfCnpj,
             Telefone = @telefone, Email = @email, Observacao = @observacao, Ativo = @ativo
         WHERE idFornecedor = @id`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Fornecedor não encontrado" });
    }
    res.json({ mensagem: "Fornecedor atualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar fornecedor" });
  }
});

// DELETE /fornecedores/:id - desativa (soft delete), preserva vínculo com ContaPagar.idFornecedor
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE Fornecedor SET Ativo = 'I' WHERE idFornecedor = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Fornecedor não encontrado" });
    }
    res.json({ mensagem: "Fornecedor desativado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao desativar fornecedor" });
  }
});

export default router;
