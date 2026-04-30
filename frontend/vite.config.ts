import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api/validate_meter': 'https://checker.sjtuguoxue.space',
      '/api/free_rhyme': 'https://checker.sjtuguoxue.space',
      '/api/rules': 'https://checker.sjtuguoxue.space',
      '/api/rhyme': 'https://checker.sjtuguoxue.space',
      '/api/char/lookup': 'https://checker.sjtuguoxue.space',
      '/api': 'http://localhost:5050',
    },
  },
})
