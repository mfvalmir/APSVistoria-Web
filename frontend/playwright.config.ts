import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "html",

  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Sobe frontend e backend automaticamente se ainda não estiverem rodando.
  webServer: [
    {
      command: "npm run dev",
      cwd: import.meta.dirname,
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      cwd: path.join(import.meta.dirname, "../backend"),
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
