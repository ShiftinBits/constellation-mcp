import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/tools/**/*.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  dts: false,
  sourcemap: false,
  clean: true,
  minify: true,
  splitting: false,
  external: ['@modelcontextprotocol/sdk'],
  treeshake: false, // Preserve tool classes
  bundle: true,
  outDir: 'dist',
  // Ensure tools maintain their structure for auto-discovery
  esbuildOptions(options) {
    options.keepNames = true // Preserve class names for MCP framework
  }
})
