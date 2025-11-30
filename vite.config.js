import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    envDir: 'env',
    plugins: [react()],
    server: {
        port: 5173,
    },
    build: {
        // Code splitting for better landing page performance
        rollupOptions: {
            output: {
                manualChunks: {
                    // Vendor chunks
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
                    'vendor-ai': ['@google/generative-ai', 'openai'],
                },
            },
        },
        // Target modern browsers for smaller bundle
        target: 'es2020',
        // Increase chunk size warning limit slightly
        chunkSizeWarningLimit: 600,
    },
});
