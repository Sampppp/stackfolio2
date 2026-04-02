import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Needed for Docker container port mapping
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true // Needed for HMR on certain host OS file systems
    }
  }
})