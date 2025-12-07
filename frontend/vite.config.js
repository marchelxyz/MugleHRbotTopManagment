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
        manualChunks(id) {
          // Разделяем node_modules на отдельные чанки
          if (id.includes('node_modules')) {
            // React и React DOM
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Lottie (большая библиотека для анимаций)
            if (id.includes('lottie') || id.includes('react-lottie-player')) {
              return 'lottie-vendor';
            }
            // Chart.js (большая библиотека для графиков)
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'chart-vendor';
            }
            // React Icons (может быть большим)
            if (id.includes('react-icons')) {
              return 'icons-vendor';
            }
            // React DatePicker
            if (id.includes('react-datepicker')) {
              return 'datepicker-vendor';
            }
            // Axios
            if (id.includes('axios')) {
              return 'axios-vendor';
            }
            // Остальные vendor библиотеки
            return 'vendor';
          }
        },
      },
    },
    // Увеличиваем размер предупреждений для больших чанков
    chunkSizeWarningLimit: 2000,
  },
  // Оптимизация для продакшена
  server: {
    headers: {
      'Cache-Control': 'public, max-age=31536000',
    },
  },
})
