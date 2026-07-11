import { test, expect } from "@playwright/test";

test.describe("Módulo de Usuários", () => {
  test("lista carrega com os usuários cadastrados", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Cadastro de Usuários").click();

    await expect(page.getByRole("columnheader", { name: "Usuário" })).toBeVisible();
    await expect(page.locator(".usuarios-tabela tbody tr").first()).toBeVisible();
  });

  test("busca filtra a lista", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Cadastro de Usuários").click();

    await page.getByPlaceholder("Buscar...").fill("thenya");

    await expect(page.locator(".usuarios-tabela tbody")).toContainText(/Thenya/i);
    await expect(page.locator(".usuarios-tabela tbody tr")).toHaveCount(1);
  });

  test("abre o formulário de criação com os campos esperados", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Cadastro de Usuários").click();
    await page.getByText("Criar Usuário").click();

    await expect(page.getByText("Novo Usuário")).toBeVisible();
    await expect(page.getByLabel("Nome de usuário")).toBeVisible();
    await expect(page.getByPlaceholder("Digite o nome para buscar...")).toBeVisible();
    await expect(page.getByLabel("Administrador")).toBeVisible();
  });

  test("abre o perfil de permissões pelo ícone de escudo", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Cadastro de Usuários").click();
    await page.locator('.usuarios-icone-acao[title="Perfil de permissões"]').first().click();

    await expect(page.getByText("Aplicações disponíveis para repasse")).toBeVisible();
    await expect(page.getByText("Aplicações repassadas")).toBeVisible();
  });
});
