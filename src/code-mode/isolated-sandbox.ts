/**
 * Isolated Sandbox (SB-258 Step 3.1)
 *
 * Parent-side wrapper that executes code in a child process for true
 * process-level isolation. Same interface as CodeModeSandbox but forks
 * a sandbox-worker child process for each execution.
 *
 * Benefits over convenience (vm) sandbox:
 * - Hard memory limit via --max-old-space-size (enforced by V8)
 * - True timeout via SIGKILL (no escape)
 * - Crash isolation (child crash doesn't affect MCP server)
 * - Separate V8 heap (no prototype pollution cross-talk)
 *
 * Activation: CONSTELLATION_SANDBOX_ISOLATION=hardened
 */

import { fork, type ChildProcess } from 'child_process';
import type { SandboxOptions, SandboxResult } from './sandbox.js';
import type { WorkerRequest, WorkerResponse } from './sandbox-worker.js';
import { CodeModeSandbox } from './sandbox.js';
import { WORKER_PATH } from './worker-path.js';
import {
	DEFAULT_EXECUTION_TIMEOUT_MS,
	DEFAULT_MEMORY_LIMIT_MB,
} from '../constants/index.js';

/**
 * Process-isolated sandbox that runs code in a child process
 */
export class IsolatedSandbox {
	private options: SandboxOptions;
	private timeout: number;
	private memoryLimit: number;
	/** Convenience sandbox for validation only (no execution) */
	private validationSandbox: CodeModeSandbox;

	constructor(options: SandboxOptions) {
		this.options = options;
		this.timeout = options.timeout || DEFAULT_EXECUTION_TIMEOUT_MS;
		this.memoryLimit = options.memoryLimit || DEFAULT_MEMORY_LIMIT_MB;
		// Create a convenience sandbox solely for code validation
		this.validationSandbox = new CodeModeSandbox(options);
	}

	/**
	 * Execute code in an isolated child process
	 */
	async execute(code: string): Promise<SandboxResult> {
		const startTime = Date.now();

		// Validate code before spawning a child process (fail fast)
		const validation = this.validateCode(code);
		if (!validation.valid) {
			return {
				success: false,
				error: `Security validation failed: ${validation.errors?.join(', ')}`,
				logs: validation.warnings?.map((w) => `[WARN] ${w}`) || [],
				executionTime: Date.now() - startTime,
			};
		}

		return new Promise<SandboxResult>((resolve) => {
			// Fork child process with memory limit enforced by V8
			const child: ChildProcess = fork(WORKER_PATH, [], {
				execArgv: [`--max-old-space-size=${this.memoryLimit}`],
				stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
				// Prevent child from inheriting the parent's stdin
				silent: true,
			});

			let resolved = false;
			const cleanup = () => {
				if (!resolved) {
					resolved = true;
				}
			};

			// Timeout kill — SIGKILL ensures no escape
			const timeoutHandle = setTimeout(() => {
				if (!resolved) {
					child.kill('SIGKILL');
					cleanup();
					resolve({
						success: false,
						error: `Execution timeout: Code took longer than ${this.timeout}ms to execute (hardened mode)`,
						executionTime: Date.now() - startTime,
					});
				}
			}, this.timeout + 1000); // Extra 1s buffer for IPC overhead

			// Handle worker response
			child.on('message', (message: WorkerResponse) => {
				clearTimeout(timeoutHandle);
				if (resolved) return;
				cleanup();

				if (message.type === 'result') {
					resolve(message.result);
				} else {
					resolve({
						success: false,
						error: message.error,
						executionTime: Date.now() - startTime,
					});
				}
			});

			// Handle child process errors
			child.on('error', (error: Error) => {
				clearTimeout(timeoutHandle);
				if (resolved) return;
				cleanup();
				resolve({
					success: false,
					error: `Worker process error: ${error.message}`,
					executionTime: Date.now() - startTime,
				});
			});

			// Handle unexpected child exit
			child.on('exit', (exitCode: number | null, signal: string | null) => {
				clearTimeout(timeoutHandle);
				if (resolved) return;
				cleanup();

				if (signal === 'SIGKILL') {
					resolve({
						success: false,
						error: `Worker killed (signal: SIGKILL). Likely exceeded memory limit (${this.memoryLimit}MB) or timeout.`,
						executionTime: Date.now() - startTime,
					});
				} else if (exitCode !== 0) {
					resolve({
						success: false,
						error: `Worker exited with code ${exitCode}`,
						executionTime: Date.now() - startTime,
					});
				}
				// exitCode 0 without a message means result was already sent
			});

			// Send execution request to worker
			const { configContext } = this.options;
			const request: WorkerRequest = {
				type: 'execute',
				code,
				config: {
					apiUrl: configContext.config.apiUrl,
					apiKey: configContext.apiKey,
					projectId: configContext.projectId,
					branchName: configContext.branchName,
				},
				options: {
					timeout: this.timeout,
					memoryLimit: this.memoryLimit,
					allowConsole: this.options.allowConsole,
					allowTimers: this.options.allowTimers,
					maxApiCalls: this.options.maxApiCalls,
				},
			};

			child.send(request);
		});
	}

	/**
	 * Validate code before execution (delegates to CodeModeSandbox)
	 */
	validateCode(code: string): {
		valid: boolean;
		errors?: string[];
		warnings?: string[];
	} {
		return this.validationSandbox.validateCode(code);
	}
}
