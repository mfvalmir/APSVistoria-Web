import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // permite acesso via IP na rede interna, não só localhost
    port: 5173,
    // hostname da máquina (igual ao DB_SERVER do backend) em vez do IP,
    // que muda toda vez que o DHCP renova o endereço na rede Wi-Fi.
    allowedHosts: ["ASUSVB15"],
  },
});
