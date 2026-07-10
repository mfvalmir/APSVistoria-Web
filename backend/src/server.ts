import express from "express";
import cors from "cors";
import "dotenv/config";
import usuariosRouter from "./routes/usuarios";
import authRouter from "./routes/auth";

const app = express();

app.use(express.json());

// CORS restrito à origem definida no .env.
// Hoje (rede interna) aponta pro IP do frontend; na internet, vira o domínio real.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
  })
);

app.use("/usuarios", usuariosRouter);
app.use("/auth", authRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
