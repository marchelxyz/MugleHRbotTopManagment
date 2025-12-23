import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Оптимизация для удаления console.log в продакшене
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    // Оптимизация сборки для лучшего кеширования
    rollupOptions: {
      output: {
        // Разделение vendor и app кода для лучшего кеширования
        manualChunks: (id) => {
          // ВАЖНО: Все React-зависимые библиотеки должны быть в одном чанке с React
          // чтобы избежать ошибок типа "Cannot read properties of undefined (reading 'useLayoutEffect')"
          if (
            id.includes('node_modules/react') || 
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-icons') ||
            id.includes('node_modules/react-barcode') ||
            id.includes('node_modules/react-input-mask') ||
            id.includes('node_modules/react-chartjs-2') ||
            id.includes('node_modules/react-lottie-player') ||
            id.includes('node_modules/react-datepicker') ||
            id.includes('node_modules/react-onclickoutside') ||
            id.includes('node_modules/scheduler') // React scheduler
          ) {
            return 'react-vendor';
          }
          // Chart.js (не зависит от React напрямую)
          if (id.includes('node_modules/chart.js')) {
            return 'chart-vendor';
          }
          // Lottie-web (не зависит от React напрямую)
          if (id.includes('node_modules/lottie-web')) {
            return 'lottie-vendor';
          }
          // Axios в отдельный чанк
          if (id.includes('node_modules/axios')) {
            return 'axios-vendor';
          }
          // Date-fns в отдельный чанк
          if (id.includes('node_modules/date-fns')) {
            return 'date-vendor';
          }
          // Остальные node_modules в общий vendor чанк
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    // Увеличиваем размер предупреждений для больших чанков
    chunkSizeWarningLimit: 1000,
    // Используем встроенный esbuild minifier (быстрее чем terser)
    minify: 'esbuild',
    // Включаем source maps только для отладки
    sourcemap: false,
  },
  // Оптимизация для продакшена
  server: {
    headers: {
      'Cache-Control': 'public, max-age=31536000',
    },
  },
})
