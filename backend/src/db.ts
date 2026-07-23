import sql from "mssql";
import "dotenv/config";

// Toda a configuração vem de variáveis de ambiente (.env).
// Assim, ao mudar de rede interna -> internet, você só troca o .env,
// nunca precisa mexer no código.
const config: sql.config = {
  server: process.env.DB_SERVER || "localhost",
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true", // true é obrigatório em produção/internet
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    // driver por padrão trata datetime como UTC (useUTC: true), mas o banco guarda
    // horário local (Brasília) - com isso as leituras vinham 3h atrasadas e as
    // gravações de "new Date()" (dataAlteracao etc.) 3h adiantadas.
    useUTC: false,
  },
  // Default da lib é 15s - curto demais para absorver uma lentidão pontual do SQL Server
  // logo após uma sequência de INSERTs (ex: criar Cliente + Vistoria em seguida), que já
  // foi observada estourando esse limite mesmo com a query da listagem sendo instantânea
  // em condições normais.
  requestTimeout: 30000,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) return pool;
  pool = await new sql.ConnectionPool(config).connect();
  console.log("Conectado ao SQL Server");
  return pool;
}

export { sql };
