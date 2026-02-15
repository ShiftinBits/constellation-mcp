/**
 * Sandbox Worker (SB-258 Step 3.1)
 *
 * Child process entry point for hardened sandbox isolation.
 * Receives code + config via IPC, executes in CodeModeSandbox,
 * and sends SandboxResult back to the parent.
 *
 * Launched via child_process.fork() from IsolatedSandbox.
 * The child process provides true memory isolation (--max-old-space-size)
 * and crash isolation from the parent MCP server.
 */

import { CodeModeSandbox } from './sandbox.js';
import { ConstellationConfig } from '../config/config.js';
import type { ConfigContext } from '../config/config-cache.js';
import type { SandboxOptions, SandboxResult } from './sandbox.js';

/**
 * IPC message from parent to worker
 */
export interface WorkerRequest {
	type: 'execute';
	code: string;
	config: {
		apiUrl: string;
		apiKey: string;
		projectId: string;
		branchName: string;
		languages: Record<string, { fileExtensions: string[] }>;
		gitRoot: string;
	};
	options: {
		timeout?: number;
		memoryLimit?: number;
		allowConsole?: boolean;
		allowTimers?: boolean;
		maxApiCalls?: number;
	};
}

/**
 * IPC message from worker to parent
 */
export type WorkerResponse =
	| { type: 'result'; result: SandboxResult }
	| { type: 'error'; error: string };

/**
 * Handle incoming IPC messages from parent
 */
function handleMessage(message: WorkerRequest): void {
	if (message.type !== 'execute') {
		sendResponse({
			type: 'error',
			error: `Unknown message type: ${(message as any).type}`,
		});
		return;
	}

	executeCode(message)
		.then((result) => {
			sendResponse({ type: 'result', result });
		})
		.catch((error) => {
			sendResponse({
				type: 'error',
				error: error instanceof Error ? error.message : String(error),
			});
		});
}

/**
 * Execute code in a CodeModeSandbox within this child process
 */
async function executeCode(request: WorkerRequest): Promise<SandboxResult> {
	const { code, config, options } = request;

	// Reconstruct ConfigContext from serialized config
	const configContext: ConfigContext = {
		config: new ConstellationConfig(
			config.apiUrl,
			config.branchName,
			config.languages,
			config.projectId,
		),
		projectId: config.projectId,
		branchName: config.branchName,
		apiKey: config.apiKey,
		configLoaded: true,
		gitRoot: config.gitRoot,
	};

	const sandboxOptions: SandboxOptions = {
		configContext,
		timeout: options.timeout,
		memoryLimit: options.memoryLimit,
		allowConsole: options.allowConsole,
		allowTimers: options.allowTimers,
		maxApiCalls: options.maxApiCalls,
		projectContext: {
			projectId: config.projectId,
			branchName: config.branchName,
		},
	};

	const sandbox = new CodeModeSandbox(sandboxOptions);
	return sandbox.execute(code);
}

/**
 * Send response back to parent via IPC
 */
function sendResponse(response: WorkerResponse): void {
	if (process.send) {
		process.send(response);
	}
	// Exit after sending result — worker is single-use
	// Use exit code 1 for errors so monitoring/logging can distinguish
	process.exit(response.type === 'error' ? 1 : 0);
}

// Listen for IPC messages from parent
process.on('message', handleMessage);
