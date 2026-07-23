import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
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
import contaReceberRouter from "./routes/contaReceber";
import caixaRouter from "./routes/caixa";
import dashboardRouter from "./routes/dashboard";
import vistoriaRouter from "./routes/vistoria";

const app = express();

app.use(express.json());

// CORS aceita as origens fixas do .env (localhost, hostname do PC) e, além disso,
// qualquer IP de rede privada (192.168.x.x, 10.x.x.x, 172.16-31.x.x) em qualquer porta
// - assim celular/outros dispositivos na mesma rede acessam sem precisar cadastrar
// cada IP manualmente (e sem quebrar quando o DHCP troca o IP da máquina).
const corsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);
const redePrivadaRegex =
  /^https?:\/\/(10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d+)?$/;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin) || redePrivadaRegex.test(origin)) {
        return callback(null, true);
      }
      callback(new Error("Origem não permitida pelo CORS"));
    },
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
app.use("/conta-receber", contaReceberRouter);
app.use("/caixa", caixaRouter);
app.use("/dashboard", dashboardRouter);
app.use("/vistoria", vistoriaRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", banco: process.env.DB_NAME });
});

// Serve o build do frontend (frontend/dist) quando presente, permitindo que
// backend e frontend rodem sob a mesma origem/porta em produção (sem CORS).
// Em dev (sem build gerado) essa parte simplesmente não é ativada.
const frontendDistPath = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
