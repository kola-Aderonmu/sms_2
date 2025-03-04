import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    'require("crypto")': 'require("crypto-browserify")',
  },
  resolve: {
    alias: {
      crypto: "crypto-browserify",
    },
  },
});
