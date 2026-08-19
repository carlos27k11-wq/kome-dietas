import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Rutas relativas: así funciona tanto en la raíz de un dominio
  // como en https://usuario.github.io/kome-dietas/
  base: './',
  build: { outDir: 'dist' }
})
