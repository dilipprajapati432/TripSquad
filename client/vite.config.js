import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build' && !env.VITE_API_URL) {
    // The app would silently call http://localhost:5000 from users' browsers
    console.warn('\n\u26a0  VITE_API_URL is not set: the built app will try to reach http://localhost:5000.\n   Set it to your deployed API (e.g. in Vercel → Settings → Environment Variables).\n')
  }
  return {
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          // Big libraries in their own files: cached separately and only loaded on the trip page
          advancedChunks: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
              { name: 'map', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/ },
              { name: 'dnd', test: /node_modules[\\/]@dnd-kit[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
