import { test as base, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
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

// A sessão vive em sessionStorage (não localStorage - ver App.tsx), então não dá pra
// reaproveitar via `storageState` do Playwright, que só persiste localStorage/cookies.
// Em vez disso, cada teste que usar este `test` já nasce com o token semeado via
// addInitScript, que roda antes de qualquer script da página em toda navegação.
export const test = base.extend({
  page: async ({ page }, use) => {
    const envBackend = lerEnv(path.join(import.meta.dirname, "../../backend/.env"));
    const token = assinarJwt(
      { id: 1, idFuncionario: 999, nome: "DESENVOLVIMENTO", login: "DESENVOLVIMENTO", administrador: true },
      envBackend.JWT_SECRET
    );
    await page.addInitScript((t) => {
      window.sessionStorage.setItem("token", t);
    }, token);
    await use(page);
  },
});

export { expect };
