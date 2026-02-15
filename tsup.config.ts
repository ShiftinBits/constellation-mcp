import { defineConfig } from 'tsup';

export default defineConfig([
	{
		entry: ['src/index.ts'],
		format: ['esm'],
		platform: 'node',
		target: 'node20',
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
	},
	{
		// Sandbox worker — separate entry point for child_process.fork() (SB-258)
		// Must be a standalone file since IsolatedSandbox spawns it as a child process
		entry: { 'sandbox-worker': 'src/code-mode/sandbox-worker.ts' },
		format: ['esm'],
		platform: 'node',
		target: 'node20',
		dts: false,
		sourcemap: false,
		clean: false, // Don't wipe dist (index.js already built above)
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
			options.keepNames = true;
		},
	},
]);
