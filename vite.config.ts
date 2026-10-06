import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Tauri は固定ポートの開発サーバを前提とする
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  // 変換パイプラインのテストは、最初の呼び出しで Shiki の初期化 (WASM と文法の読み込み) を含む。
  // CI のランナーでは既定の 5 秒を超えることがある
  test: { environment: "node", include: ["src/**/*.test.ts"], testTimeout: 30_000 },
});
