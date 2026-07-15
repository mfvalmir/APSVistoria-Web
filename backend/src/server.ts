import express from "express";
import cors from "cors";
import "dotenv/config";
import usuariosRouter from "./routes/usuarios";
import authRouter from "./routes/auth";
import menuRouter from "./routes/menu";
import funcionariosRouter from "./routes/funcionarios";
import formulariosRouter from "./routes/formularios";
import permissoesRouter from "./routes/permissoes";
import cidadesRouter from "./routes/cidades";
import bairrosRouter from "./routes/bairros";
import funcaoRouter from "./routes/funcao";
import categoriaRouter from "./routes/categoria";
import bancoRouter from "./routes/banco";
import clientesRouter from "./routes/clientes";
import responsaveisRouter from "./routes/responsaveis";
import servicoRouter from "./routes/servico";
import tipoPagamentoRouter from "./routes/tipoPagamento";
import fornecedoresRouter from "./routes/fornecedores";
import contaPagarRouter from "./routes/contaPagar";
import dashboardRouter from "./routes/dashboard";

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
app.use("/usuarios", permissoesRouter);
app.use("/auth", authRouter);
app.use("/menu", menuRouter);
app.use("/funcionarios", funcionariosRouter);
app.use("/formularios", formulariosRouter);
app.use("/cidades", cidadesRouter);
app.use("/bairros", bairrosRouter);
app.use("/funcao", funcaoRouter);
app.use("/categoria", categoriaRouter);
app.use("/banco", bancoRouter);
app.use("/clientes", clientesRouter);
app.use("/clientes", responsaveisRouter);
app.use("/servico", servicoRouter);
app.use("/tipo-pagamento", tipoPagamentoRouter);
app.use("/fornecedores", fornecedoresRouter);
app.use("/conta-pagar", contaPagarRouter);
app.use("/dashboard", dashboardRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", banco: process.env.DB_NAME });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
