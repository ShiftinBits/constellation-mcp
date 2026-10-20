import type { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createRequire } from 'module';
import { configCache } from './config/config-cache.js';
import { buildServer } from './server.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

/**
 * Initializes and starts the Constellation MCP Server.
 */
async function startServer() {
	try {
		console.error('[CONSTELLATION] Starting server...');
		console.error('[CONSTELLATION] Environment check:');
		console.error(
			`  CONSTELLATION_ACCESS_KEY: ${process.env.CONSTELLATION_ACCESS_KEY ? '***SET***' : 'NOT SET'}`,
		);
		console.error(`  Working directory: ${process.cwd()}`);

		// Initialize configuration cache with default from startup directory
		// This is non-fatal - if it fails, server will require cwd parameter on each call
		await configCache.trySetDefaultFromStartup(process.cwd());

		// Report configuration status
		const defaultConfig = configCache.getDefaultConfig();
		if (defaultConfig) {
			if (defaultConfig.initializationError) {
				console.error(
					'[CONSTELLATION] WARNING: Server starting in degraded mode',
				);
				console.error(
					'[CONSTELLATION] Configuration error:',
					defaultConfig.initializationError,
				);
				console.error(
					'[CONSTELLATION] Tools will return setup instructions when called',
				);
			}

			console.error('[CONSTELLATION] Default configuration loaded:');
			console.error(`  Git root: ${defaultConfig.gitRoot}`);
			console.error(`  Project: ${defaultConfig.projectId}`);
			console.error(`  Branch: ${defaultConfig.branchName}`);
		} else {
			console.error(
				'[CONSTELLATION] No default configuration (will require cwd parameter)',
			);
		}

		const serverOptions = { version: packageJson.version };

		// Build once up front so a registration error fails fast with the banner
		// below; serveStdio would otherwise only hit it on the first client message
		let prebuilt: McpServer | undefined = buildServer(serverOptions);

		// serveStdio picks the protocol era from the client's opening message
		// (2026-07-28 or a legacy initialize); its first factory call reuses the
		// prebuilt server, and any later call (legacy fallback) builds a fresh one
		serveStdio(
			() => {
				const server = prebuilt ?? buildServer(serverOptions);
				prebuilt = undefined;
				return server;
			},
			{
				onerror: (error) =>
					console.error('[CONSTELLATION] stdio error:', error),
			},
		);

		console.error(
			'[CONSTELLATION] Code Mode Only - 1 powerful tool for all operations',
		);
		console.error('[CONSTELLATION] Listening on stdio');
	} catch (error) {
		console.error(
			'\n==========================================================',
		);
		console.error('CONSTELLATION MCP SERVER FAILED TO START');
		console.error(
			'==========================================================\n',
		);

		if (error instanceof Error) {
			console.error(error.message);
		} else {
			console.error('Unknown error:', error);
		}

		console.error(
			'\n==========================================================\n',
		);
		process.exit(1);
	}
}

// Start the server
startServer();
