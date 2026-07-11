import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SELECT_BASE = `
  SELECT f.IdFuncionario, f.NomeFuncionario, f.Endereco, f.CEP, f.idBairro, b.DescricaoBairro,
         f.TelCelular, f.TelResidencial, f.idFuncao, fu.descricao AS Funcao, f.FazVistoria,
         f.DataAdmissao, f.Salario, f.IDBanco, bc.DescricaoBanco, f.Agencia, f.NumContaBanco,
         f.CPF, f.ChavePix, f.DataNascimento, f.Observacao, f.Situacao
  FROM Funcionario f
  LEFT JOIN Bairro b ON b.IDBairro = f.idBairro
  LEFT JOIN Funcao fu ON fu.idFuncao = f.idFuncao
  LEFT JOIN Banco bc ON bc.idBanco = f.IDBanco
`;

// GET /funcionarios/buscar?busca=&semUsuario=1 - combobox leve (usado pelo form de Usuário)
router.get("/buscar", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const semUsuario = req.query.semUsuario === "1";

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes = ["LTRIM(RTRIM(f.Situacao)) = 'A'"];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("f.NomeFuncionario LIKE @busca");
    }
    if (semUsuario) {
      condicoes.push("NOT EXISTS (SELECT 1 FROM usuario u WHERE u.IDFuncionario = f.IdFuncionario)");
    }

    const result = await request.query(
      `SELECT TOP 20 f.IdFuncionario, f.NomeFuncionario
       FROM Funcionario f
       WHERE ${condicoes.join(" AND ")}
       ORDER BY f.NomeFuncionario`
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar funcionários" });
  }
});

// GET /funcionarios/funcoes - lista completa para o select de Função
router.get("/funcoes", authMiddleware, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT idFuncao, descricao FROM Funcao ORDER BY descricao");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar funções" });
  }
});

// GET /funcionarios/bancos - lista completa para o select de Banco
router.get("/bancos", authMiddleware, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT idBanco, DescricaoBanco FROM Banco ORDER BY DescricaoBanco");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar bancos" });
  }
});

// GET /funcionarios/bairros?busca= - autocomplete de Bairro (329 linhas, não cabe num select)
router.get("/bairros", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("b.DescricaoBairro LIKE @busca");
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

    const result = await request.query(
      `SELECT TOP 20 b.IDBairro, b.DescricaoBairro, c.DescricaoCidade, c.UF
       FROM Bairro b
       LEFT JOIN Cidade c ON c.idCidade = b.idCidade
       ${where}
       ORDER BY b.DescricaoBairro`
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar bairros" });
  }
});

// GET /funcionarios?busca=&status= - lista com filtros
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const status = (req.query.status as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("f.NomeFuncionario LIKE @busca");
    }
    if (status === "A" || status === "I") {
      request.input("status", sql.NChar, status);
      condicoes.push("LTRIM(RTRIM(f.Situacao)) = @status");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY f.NomeFuncionario`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar funcionários" });
  }
});

// GET /funcionarios/:id - um funcionário (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE f.IdFuncionario = @id`);

    const funcionario = result.recordset[0];
    if (!funcionario) return res.status(404).json({ erro: "Funcionário não encontrado" });
    res.json(funcionario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar funcionário" });
  }
});

// POST /funcionarios - cria um novo funcionário
router.post("/", authMiddleware, async (req, res) => {
  const {
    nomeFuncionario,
    endereco,
    cep,
    idBairro,
    telCelular,
    telResidencial,
    idFuncao,
    fazVistoria,
    dataAdmissao,
    salario,
    idBanco,
    agencia,
    numContaBanco,
    cpf,
    chavePix,
    dataNascimento,
    observacao,
  } = req.body;

  if (!nomeFuncionario) {
    return res.status(400).json({ erro: "nomeFuncionario é obrigatório" });
  }

  try {
    const pool = await getPool();

    // IdFuncionario não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    await pool
      .request()
      .input("nomeFuncionario", sql.VarChar, nomeFuncionario)
      .input("endereco", sql.VarChar, endereco || null)
      .input("cep", sql.VarChar, cep || null)
      .input("idBairro", sql.Int, idBairro || null)
      .input("telCelular", sql.VarChar, telCelular || null)
      .input("telResidencial", sql.VarChar, telResidencial || null)
      .input("idFuncao", sql.Int, idFuncao || null)
      .input("fazVistoria", sql.Bit, !!fazVistoria)
      .input("dataAdmissao", sql.DateTime, dataAdmissao || null)
      .input("salario", sql.Money, salario || null)
      .input("idBanco", sql.Int, idBanco || null)
      .input("agencia", sql.VarChar, agencia || null)
      .input("numContaBanco", sql.VarChar, numContaBanco || null)
      .input("cpf", sql.VarChar, cpf || null)
      .input("chavePix", sql.VarChar, chavePix || null)
      .input("dataNascimento", sql.VarChar, dataNascimento || null)
      .input("observacao", sql.Text, observacao || null)
      .query(
        `INSERT INTO Funcionario
           (IdFuncionario, NomeFuncionario, Endereco, CEP, idBairro, TelCelular, TelResidencial,
            idFuncao, FazVistoria, DataAdmissao, Salario, IDBanco, Agencia, NumContaBanco,
            CPF, ChavePix, DataNascimento, Observacao, Situacao)
         VALUES
           ((SELECT ISNULL(MAX(IdFuncionario), 0) + 1 FROM Funcionario), @nomeFuncionario, @endereco, @cep,
            @idBairro, @telCelular, @telResidencial, @idFuncao, @fazVistoria, @dataAdmissao, @salario,
            @idBanco, @agencia, @numContaBanco, @cpf, @chavePix, @dataNascimento, @observacao, 'A')`
      );

    res.status(201).json({ mensagem: "Funcionário criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar funcionário" });
  }
});

// PUT /funcionarios/:id - edita um funcionário
router.put("/:id", authMiddleware, async (req, res) => {
  const {
    nomeFuncionario,
    endereco,
    cep,
    idBairro,
    telCelular,
    telResidencial,
    idFuncao,
    fazVistoria,
    dataAdmissao,
    salario,
    idBanco,
    agencia,
    numContaBanco,
    cpf,
    chavePix,
    dataNascimento,
    observacao,
    situacao,
  } = req.body;

  if (!nomeFuncionario || !situacao) {
    return res.status(400).json({ erro: "nomeFuncionario e situacao são obrigatórios" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("nomeFuncionario", sql.VarChar, nomeFuncionario)
      .input("endereco", sql.VarChar, endereco || null)
      .input("cep", sql.VarChar, cep || null)
      .input("idBairro", sql.Int, idBairro || null)
      .input("telCelular", sql.VarChar, telCelular || null)
      .input("telResidencial", sql.VarChar, telResidencial || null)
      .input("idFuncao", sql.Int, idFuncao || null)
      .input("fazVistoria", sql.Bit, !!fazVistoria)
      .input("dataAdmissao", sql.DateTime, dataAdmissao || null)
      .input("salario", sql.Money, salario || null)
      .input("idBanco", sql.Int, idBanco || null)
      .input("agencia", sql.VarChar, agencia || null)
      .input("numContaBanco", sql.VarChar, numContaBanco || null)
      .input("cpf", sql.VarChar, cpf || null)
      .input("chavePix", sql.VarChar, chavePix || null)
      .input("dataNascimento", sql.VarChar, dataNascimento || null)
      .input("observacao", sql.Text, observacao || null)
      .input("situacao", sql.NChar, situacao)
      .query(
        `UPDATE Funcionario
         SET NomeFuncionario = @nomeFuncionario, Endereco = @endereco, CEP = @cep, idBairro = @idBairro,
             TelCelular = @telCelular, TelResidencial = @telResidencial, idFuncao = @idFuncao,
             FazVistoria = @fazVistoria, DataAdmissao = @dataAdmissao, Salario = @salario,
             IDBanco = @idBanco, Agencia = @agencia, NumContaBanco = @numContaBanco, CPF = @cpf,
             ChavePix = @chavePix, DataNascimento = @dataNascimento, Observacao = @observacao,
             Situacao = @situacao
         WHERE IdFuncionario = @id`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Funcionário não encontrado" });
    }
    res.json({ mensagem: "Funcionário atualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar funcionário" });
  }
});

// DELETE /funcionarios/:id - desativa (soft delete), preserva vínculo com usuario.IDFuncionario
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE Funcionario SET Situacao = 'I' WHERE IdFuncionario = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Funcionário não encontrado" });
    }
    res.json({ mensagem: "Funcionário desativado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao desativar funcionário" });
  }
});

export default router;
