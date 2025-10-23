import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/tools/**/*.ts', 'src/config/**/*.ts', 'src/client/**/*.ts', 'src/utils/**/*.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  dts: false,
  sourcemap: false,
  clean: true,
  minify: false, // Disable minification to preserve module structure
  splitting: true, // Enable code splitting to share modules
  external: ['@modelcontextprotocol/sdk'],
  treeshake: false, // Preserve tool classes
  bundle: false, // Disable bundling to preserve module imports
  outDir: 'dist',
  // Ensure tools maintain their structure for auto-discovery
  esbuildOptions(options) {
    options.keepNames = true // Preserve class names for MCP framework
  }
})
