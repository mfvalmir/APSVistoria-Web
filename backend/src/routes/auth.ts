import { Router } from "express";
import jwt from "jsonwebtoken";
import { getPool, sql } from "../db";
import { criptografar } from "../legacyCrypt";

const router = Router();

// POST /auth/login
router.post("/login", async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: "Informe usuário e senha" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("login", sql.VarChar, usuario)
      .query(
        `SELECT u.IDUser, u.IDFuncionario, u.Loginn, u.Senha, u.Situacao, u.Administrador,
                f.NomeFuncionario
         FROM usuario u
         LEFT JOIN Funcionario f ON f.IdFuncionario = u.IDFuncionario
         WHERE u.Loginn = @login`
      );

    const user = result.recordset[0];
    if (!user || user.Situacao.trim() !== "A") {
      return res.status(401).json({ erro: "Usuário ou senha inválidos" });
    }

    const senhaCriptografada = criptografar(process.env.LEGACY_CRYPT_KEY as string, senha);
    if (senhaCriptografada !== user.Senha.trim().toLowerCase()) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos" });
    }

    const token = jwt.sign(
      {
        id: user.IDUser,
        idFuncionario: user.IDFuncionario,
        nome: user.NomeFuncionario,
        login: user.Loginn,
        administrador: user.Administrador.trim() === "S",
      },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN || "8h") as jwt.SignOptions["expiresIn"] }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao autenticar" });
  }
});

export default router;
