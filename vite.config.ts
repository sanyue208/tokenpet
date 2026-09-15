import { defineConfig } from "vite";

// Tauri expects a fixed dev server port and uses the dist folder for the build.
// base: "./" 让产物用相对路径，既能跑在 Tauri 自定义协议下，也能在子路径/文件预览里正常加载（修复白屏）。
export default defineConfig({
  base: "./",
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
    },
  },
  build: {
    target: "es2021",
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
