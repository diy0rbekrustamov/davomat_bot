import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/teacher/',
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['davomat.provveb.uz'],
    cors: true
  }
})
