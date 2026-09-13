import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({
  plugins: [
    react(),
    cloudflare({ configPath: process.env.CLOUDFLARE_CONFIG_PATH }),
  ],
  build: { outDir: "dist" },
});
