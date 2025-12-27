import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

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
    plugins: [
        react(),
        // 🔧 OTIMIZAÇÃO: Compressão Brotli (melhor compressão)
        viteCompression({
            algorithm: 'brotliCompress',
            ext: '.br',
            threshold: 1024, // Só comprime arquivos > 1KB
        }),
        // 🔧 OTIMIZAÇÃO: Compressão Gzip (fallback para browsers antigos)
        viteCompression({
            algorithm: 'gzip',
            ext: '.gz',
            threshold: 1024,
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        }
    }
});

