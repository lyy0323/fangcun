import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shivaProxy = {
  target: process.env.SHIVA_API_TARGET ?? 'http://localhost:5050',
  changeOrigin: false,
  ...(process.env.SHIVA_API_HOST ? { headers: { host: process.env.SHIVA_API_HOST } } : {}),
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      // 配置 SHIVA_API_TARGET 时，所有 API 经 shiva，便于验证代理链及统计。
      // 常规联调可用 CHECKER_PROXY=http://localhost:5051 指向本地 checker 服务。
      ...(process.env.SHIVA_API_TARGET ? {} : {
        '/api/validate_meter': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
        '/api/free_rhyme': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
        '/api/rules': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
        '/api/rhyme': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
        '/api/char/lookup': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
      }),
      '/api': shivaProxy,
      '/dashboard': shivaProxy,
      '/docs': shivaProxy,
      '/download/android': shivaProxy,
    },
  },
})
