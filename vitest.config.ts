import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // 装配层与 Worker/遮罩窗/生成面板/日志基础设施不在覆盖率统计内
      exclude: [
        'src/main.ts',
        'src/app.ts',
        'src/scanner/worker.ts',
        'src/region/overlay.ts',
        'src/generator/panel.ts',
        'src/shared/log.ts',
      ],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
})
