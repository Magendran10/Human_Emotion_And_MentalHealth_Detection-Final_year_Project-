import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),

    // Apply COOP/COEP headers to EVERY request (HTML, JS, WASM, workers)
    // These are required for SharedArrayBuffer used by ONNX Runtime
    {
      name: 'configure-response-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
          next()
        })
      },
    },
  ],

  // Serve .onnx and .wasm as static binary assets
  assetsInclude: ['**/*.onnx', '**/*.wasm'],

  optimizeDeps: {
    // CRITICAL: exclude transformers.js from Vite's pre-bundler entirely
    // When Vite bundles it, the dynamic WASM imports that ONNX Runtime uses
    // (ort-wasm-simd.wasm, ort-wasm-simd-threaded.jsep.mjs etc.) break,
    // causing registerBackend to be undefined
    exclude: ['@xenova/transformers', 'onnxruntime-web'],
  },

  worker: {
    // worker.js in /public is a real ES module — must be declared as 'module'
    // Without this, the import statements inside worker.js will fail
    format: 'es',
  },

  build: {
    // Prevent Rollup from mangling the transformers.js imports at build time
    rollupOptions: {
      external: ['@xenova/transformers'],
    },
  },
})