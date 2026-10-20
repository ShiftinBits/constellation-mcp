import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
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

		const __filename = fileURLToPath(import.meta.url);
		const apiTypesPath = path.join(
			path.dirname(__filename),
			'types',
			'api-types.d.ts',
		);

		// serveStdio picks the protocol era from the client's opening message
		// (2026-07-28 or a legacy initialize) and builds one server per connection
		serveStdio(() =>
			buildServer({ version: packageJson.version, apiTypesPath }),
		);

		console.error(
			'[CONSTELLATION] Code Mode Only - 1 powerful tool for all operations',
		);
		console.error('[CONSTELLATION] Server ready on stdio');
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
