import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Оптимизация сборки для лучшего кеширования и code-splitting
    rollupOptions: {
      output: {
        // Разделение vendor и app кода для лучшего кеширования
        manualChunks(id) {
          // Разделяем node_modules на отдельные чанки
          if (id.includes('node_modules')) {
            // React и React DOM - основные библиотеки
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            
            // Chart.js библиотеки - используются только в админке
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'charts-vendor';
            }
            
            // Date picker - используется редко
            if (id.includes('react-datepicker') || id.includes('date-fns')) {
              return 'datepicker-vendor';
            }
            
            // React Icons - большая библиотека
            if (id.includes('react-icons')) {
              return 'icons-vendor';
            }
            
            // Axios для HTTP запросов
            if (id.includes('axios')) {
              return 'axios-vendor';
            }
            
            // Другие библиотеки
            if (id.includes('react-barcode') || id.includes('react-input-mask') || id.includes('react-lottie-player')) {
              return 'ui-libs-vendor';
            }
            
            // Остальные node_modules
            return 'vendor';
          }
        },
      },
    },
    // Увеличиваем размер предупреждений для больших чанков
    chunkSizeWarningLimit: 1000,
  },
  // Оптимизация для продакшена
  server: {
    headers: {
      'Cache-Control': 'public, max-age=31536000',
    },
  },
})
