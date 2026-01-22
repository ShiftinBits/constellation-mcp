import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	platform: 'node',
	target: 'node18',
	dts: false,
	sourcemap: false,
	clean: true,
	minify: true,
	splitting: false,
	external: ['@modelcontextprotocol/sdk'],
	treeshake: true,
	bundle: true,
	outDir: 'dist',
	outExtension() {
		return {
			js: '.js',
		};
	},
	esbuildOptions(options) {
		options.keepNames = true; // Preserve class/function names for error stack traces
	},
});
