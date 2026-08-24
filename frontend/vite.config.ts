import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      // 本地联调可用 CHECKER_PROXY=http://localhost:5051 指向本地 checker 服务
      '/api/validate_meter': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
      '/api/free_rhyme': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
      '/api/rules': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
      '/api/rhyme': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
      '/api/char/lookup': process.env.CHECKER_PROXY ?? 'https://checker.sjtuguoxue.space',
      '/api': 'http://localhost:5050',
    },
  },
})
