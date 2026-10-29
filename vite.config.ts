import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [viteSingleFile()],
  // Worker 以 ?worker&inline 引入,iife 格式确保内联后可在任意环境执行
  worker: { format: 'iife' },
  build: {
    // 大额内联上限:让 .wasm 资源以 data URI 进入单文件产物
    assetsInlineLimit: 10 * 1024 * 1024,
    chunkSizeWarningLimit: 4096,
  },
})
