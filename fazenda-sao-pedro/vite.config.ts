import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    build: {
        outDir: 'dist',
        // OTIMIZAÇÃO: Code splitting para bundles menores
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor': ['react', 'react-dom'],
                    'gemini': ['@google/genai'],
                }
            }
        },
        chunkSizeWarningLimit: 500,
        // Remove console.logs em produção
        minify: 'esbuild',
    },
    esbuild: {
        drop: ['console', 'debugger'], // Remove logs em prod
    },
    server: {
        port: 3000,
        host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        }
    }
});

