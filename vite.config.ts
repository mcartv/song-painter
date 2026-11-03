
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],

    optimizeDeps: {
        exclude: [
            'onnxruntime-web',
            '@audio/neural-runtime',
            '@audio/neural-separate',
        ],
    },

    worker: {
        format: 'es',
    },

    test: {
        environment: 'jsdom',
        globals: true,
        clearMocks: true,
    },
})
