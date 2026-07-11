import { chromium, type FullConfig } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

function lerEnv(caminho: string): Record<string, string> {
  const conteudo = readFileSync(caminho, "utf-8");
  const env: Record<string, string> = {};
  for (const linha of conteudo.split("\n")) {
    const match = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function assinarJwt(payload: object, segredo: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const agora = Math.floor(Date.now() / 1000);
  const corpo = { ...payload, iat: agora, exp: agora + 60 * 60 * 4 };
  const headerCodificado = base64url(JSON.stringify(header));
  const corpoCodificado = base64url(JSON.stringify(corpo));
  const assinatura = base64url(
    createHmac("sha256", segredo).update(`${headerCodificado}.${corpoCodificado}`).digest()
  );
  return `${headerCodificado}.${corpoCodificado}.${assinatura}`;
}

// Autentica a sessão de testes sem depender de credenciais reais: assina localmente
// um JWT válido com o mesmo JWT_SECRET do backend (backend/.env) e injeta no localStorage.
// Isso só funciona porque os testes rodam contra o ambiente de dev local.
export default async function globalSetup(config: FullConfig) {
  const envBackend = lerEnv(path.join(import.meta.dirname, "../../backend/.env"));
  const token = assinarJwt(
    { id: 1, idFuncionario: 999, nome: "DESENVOLVIMENTO", login: "DESENVOLVIMENTO", administrador: true },
    envBackend.JWT_SECRET
  );

  const baseURL = config.projects[0].use.baseURL as string;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL);
  await page.evaluate((t) => localStorage.setItem("token", t), token);

  const dirAuth = path.join(import.meta.dirname, ".auth");
  mkdirSync(dirAuth, { recursive: true });
  await page.context().storageState({ path: path.join(dirAuth, "storageState.json") });
  await browser.close();
}
