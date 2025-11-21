import { defineConfig } from 'tsup'
import { readFile, writeFile, readdir } from 'fs/promises'
import { join } from 'path'

// Recursively process all .js files in dist directory
async function addJsExtensionsToFiles(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      await addJsExtensionsToFiles(fullPath)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const contents = await readFile(fullPath, 'utf8')

      // Replace relative imports without extensions with .js extension
      const modified = contents.replace(
        /from\s+['"](\.\.?\/[^'"]+?)['"];?/g,
        (match, path) => {
          // Don't add extension if it already has one
          if (path.match(/\.(js|mjs|cjs|json)$/)) return match
          // Add .js extension
          return match.replace(path, `${path}.js`)
        }
      )

      if (contents !== modified) {
        await writeFile(fullPath, modified, 'utf8')
      }
    }
  }
}

export default defineConfig({
  entry: ['src/index.ts', 'src/tools/**/*.ts', 'src/prompts/**/*.ts', 'src/lib/**/*.ts', 'src/config/**/*.ts', 'src/client/**/*.ts', 'src/utils/**/*.ts', 'src/registry/**/*.ts', 'src/codegen/**/*.ts', 'src/code-mode/**/*.ts'],
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
  outExtension() {
    return {
      js: '.js',
    }
  },
  // Ensure tools maintain their structure for auto-discovery
  esbuildOptions(options) {
    options.keepNames = true // Preserve class names for MCP framework
  },
  async onSuccess() {
    // Add .js extensions to all relative imports after build
    await addJsExtensionsToFiles('dist')
    console.log('✓ Added .js extensions to imports')
  }
})
