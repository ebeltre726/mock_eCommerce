import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    base: './',
    // public/ holds runtime-fetched assets (templates, icons) that Vite copies as-is
    publicDir: 'public',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: 'index.html',
        },
    },
    server: {
        port: 5173,
        // Proxy API calls to the local backend during dev so no CORS issues
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
