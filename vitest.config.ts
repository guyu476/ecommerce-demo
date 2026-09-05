import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 单测配置：与 tsconfig 的 @/* 路径别名保持一致
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
