import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Оптимизация сборки для production
    target: 'es2015',
    minify: 'terser', // Используем terser для лучшей минификации
    terserOptions: {
      compress: {
        drop_console: true, // Удаляем console.log в production
        drop_debugger: true,
      },
    },
    // Разделение кода на чанки для лучшего кэширования
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          'date-vendor': ['react-datepicker'],
        },
      },
    },
    // Увеличиваем лимит предупреждений для больших чанков
    chunkSizeWarningLimit: 1000,
    // Оптимизация CSS
    cssCodeSplit: true,
    cssMinify: true,
  },
  // Оптимизация для development
  server: {
    hmr: {
      overlay: true,
    },
  },
})
