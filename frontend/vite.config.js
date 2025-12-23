import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Оптимизация сборки для лучшего кеширования
    rollupOptions: {
      output: {
        // Разделение vendor и app кода для лучшего кеширования
        manualChunks: (id) => {
          // React и React DOM в отдельный чанк
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // Axios в отдельный чанк
          if (id.includes('node_modules/axios')) {
            return 'axios-vendor';
          }
          // Chart.js и react-chartjs-2 в отдельный чанк (используется только в админке)
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
            return 'chart-vendor';
          }
          // Lottie библиотеки в отдельный чанк (тяжелые анимации)
          if (id.includes('node_modules/lottie-web') || id.includes('node_modules/react-lottie-player')) {
            return 'lottie-vendor';
          }
          // React-icons в отдельный чанк
          if (id.includes('node_modules/react-icons')) {
            return 'icons-vendor';
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
    // Включаем минификацию и оптимизацию
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Удаляем console.log в продакшене
        drop_debugger: true,
      },
    },
    // Оптимизация размера чанков
    chunkSizeWarningLimit: 1000,
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
