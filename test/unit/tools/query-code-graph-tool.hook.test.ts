/**
 * Query Code Graph Tool hook mode
 *
 * Drives the registered handler with a `hook` input. Every failure must be
 * quiet: the no-op `{}` output, no `isError`, and one `[code_intel] hook:`
 * stderr line. Successful runs emit only the allowlisted hook output keys and
 * commit newly claimed `once` keys only when that output is non-empty.
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from '@jest/globals';
import {
	hookOnceStore,
	HookOutputSchema,
} from '../../../src/code-mode/hook-mode.js';
import type { CodeModeResponse } from '../../../src/code-mode/runtime.js';
import { CodeModeRuntime } from '../../../src/code-mode/runtime.js';
import {
	configCache,
	ConfigCacheError,
	type ConfigContext,
} from '../../../src/config/config-cache.js';
import { ConstellationConfig } from '../../../src/config/config.js';
import {
	MAX_CODE_SIZE,
	MAX_HOOK_INPUT_BYTES,
} from '../../../src/constants/index.js';
import { registerQueryCodeGraphTool } from '../../../src/tools/query-code-graph-tool.js';

jest.mock('../../../src/code-mode/worker-path.js', () => ({
	WORKER_PATH: '/mocked/path/sandbox-worker.js',
}));

jest.mock('../../../src/code-mode/runtime.js');
jest.mock('../../../src/config/config-cache.js', () => ({
	configCache: {
		getConfigForPath: jest.fn(),
		getDefaultConfig: jest.fn(),
		hasDefaultConfig: jest.fn(() => true),
	},
	ConfigCacheError: class ConfigCacheError extends Error {
		constructor(
			message: string,
			public readonly code: string,
			public readonly guidance: string[],
		) {
			super(message);
			this.name = 'ConfigCacheError';
		}
	},
}));

const MockedCodeModeRuntime = CodeModeRuntime as jest.MockedClass<
	typeof CodeModeRuntime
>;
const getConfigForPath = configCache.getConfigForPath as jest.MockedFunction<
	typeof configCache.getConfigForPath
>;

interface HookArg {
	event: string;
	input?: unknown;
	sessionId?: string;
	settings?: string[];
}

interface ToolResult {
	content: Array<{ type: string; text: string }>;
	structuredContent: Record<string, unknown>;
	isError?: boolean;
}

type ToolHandler = (args: {
	code: string;
	timeout?: number;
	cwd?: string;
	hook?: HookArg;
}) => Promise<ToolResult>;

interface ExecuteRequest {
	code: string;
	timeout?: number;
	hook?: {
		event: string;
		input: unknown;
		sessionId?: string;
		settings: Record<string, string | undefined>;
		claimed: string[];
	};
}

const EMPTY_RESULT = {
	content: [{ type: 'text', text: '{}' }],
	structuredContent: {},
};

const createConfigContext = (
	overrides: Partial<ConfigContext> = {},
): ConfigContext => ({
	config: {
		apiUrl: 'https://api.constellationdev.io',
		branch: 'test-branch',
		languages: { typescript: { fileExtensions: ['.ts'] } },
		projectId: 'test-project',
		validate: jest.fn(),
	} as unknown as ConstellationConfig,
	projectId: 'test-project',
	branchName: 'test-branch',
	apiKey: 'test-key',
	configLoaded: true,
	gitRoot: '/test/project',
	...overrides,
});

let sessionCounter = 0;
/** A session id no other test has used, so the shared store stays isolated. */
const freshSessionId = () => `hook-test-session-${++sessionCounter}`;

describe('code_intel hook mode', () => {
	let execute: jest.Mock<
		(request: ExecuteRequest) => Promise<CodeModeResponse>
	>;
	let handler: ToolHandler;
	let errorSpy: jest.SpiedFunction<typeof console.error>;
	const originalEnv = { ...process.env };

	const callHook = (hook: HookArg, code = 'return hook.input') =>
		handler({ code, timeout: 2500, cwd: '/test/project', hook });

	const hookLogLines = () =>
		errorSpy.mock.calls
			.map(([line]) => line)
			.filter(
				(line): line is string =>
					typeof line === 'string' && line.startsWith('[code_intel] hook:'),
			);

	beforeEach(() => {
		jest.clearAllMocks();
		errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		getConfigForPath.mockResolvedValue(createConfigContext());

		execute = jest.fn<(request: ExecuteRequest) => Promise<CodeModeResponse>>();
		MockedCodeModeRuntime.mockImplementation(
			() => ({ execute }) as unknown as jest.Mocked<CodeModeRuntime>,
		);

		const server = {
			registerTool: jest.fn(
				(_name: string, _config: unknown, registered: ToolHandler) => {
					handler = registered;
				},
			),
		};
		registerQueryCodeGraphTool(
			server as unknown as Parameters<typeof registerQueryCodeGraphTool>[0],
		);
	});

	afterEach(() => {
		errorSpy.mockRestore();
		process.env = { ...originalEnv };
	});

	describe('quiet failures', () => {
		interface PreRuntimeCase {
			arrange?: () => void;
			hook: HookArg;
			code?: string;
		}

		const postToolUse: HookArg = { event: 'PostToolUse', input: {} };

		it.each<[string, PreRuntimeCase]>([
			['the event is unknown', { hook: { event: 'NotAnEvent', input: {} } }],
			[
				'the input exceeds the size cap',
				{
					hook: {
						event: 'PostToolUse',
						input: 'x'.repeat(MAX_HOOK_INPUT_BYTES),
					},
				},
			],
			[
				'config resolution throws CWD_NOT_INDEXED',
				{
					arrange: () => {
						getConfigForPath.mockRejectedValue(
							new ConfigCacheError('not indexed', 'CWD_NOT_INDEXED', []),
						);
					},
					hook: postToolUse,
				},
			],
			[
				'the config has an initialization error',
				{
					arrange: () => {
						getConfigForPath.mockResolvedValue(
							createConfigContext({ initializationError: 'no config' }),
						);
					},
					hook: postToolUse,
				},
			],
			[
				'no access key is configured',
				{
					arrange: () => {
						getConfigForPath.mockResolvedValue(
							createConfigContext({ apiKey: '' }),
						);
					},
					hook: postToolUse,
				},
			],
			[
				'the code exceeds the size cap',
				{ hook: postToolUse, code: 'x'.repeat(MAX_CODE_SIZE + 1) },
			],
			[
				'the code contains binary characters',
				{ hook: postToolUse, code: 'return 1\x00' },
			],
		])(
			'should return {} without running when %s',
			async (_case, { arrange, hook, code }) => {
				// Arrange
				arrange?.();

				// Act
				const result = await callHook(hook, code);

				// Assert
				expect(result).toEqual(EMPTY_RESULT);
				expect(result.isError).toBeUndefined();
				expect(execute).not.toHaveBeenCalled();
				expect(hookLogLines()).toHaveLength(1);
			},
		);

		it.each<[string, () => void]>([
			[
				'execution returns a structured error',
				() => {
					execute.mockResolvedValue({
						success: false,
						structuredError: {
							success: false,
							error: {
								code: 'EXECUTION_TIMEOUT',
								type: 'execution',
								message: 'timed out',
								recoverable: true,
								guidance: [],
							},
						},
					} as unknown as CodeModeResponse);
				},
			],
			[
				'execution reports success false',
				() => {
					execute.mockResolvedValue({ success: false, error: 'soft failure' });
				},
			],
			[
				'the branch is not indexed',
				() => {
					execute.mockResolvedValue({
						success: true,
						result: { context: 'stale' },
						resultContext: {
							reason: 'branch_not_indexed',
							branchIndexed: false,
							indexedFileCount: 0,
						},
					});
				},
			],
			[
				'the program returns null',
				() => {
					execute.mockResolvedValue({ success: true, result: null });
				},
			],
			[
				'the program returns a non-object',
				() => {
					execute.mockResolvedValue({ success: true, result: 'context' });
				},
			],
			[
				'the runtime throws',
				() => {
					execute.mockRejectedValue(new Error('boom'));
				},
			],
		])('should return {} when %s', async (_case, arrange) => {
			// Arrange
			arrange();

			// Act
			const result = await callHook({ event: 'PostToolUse', input: {} });

			// Assert
			expect(result).toEqual(EMPTY_RESULT);
			expect(result.isError).toBeUndefined();
			expect(hookLogLines()).toHaveLength(1);
		});
	});

	describe('successful output', () => {
		it('should mirror an allowlisted hook output in text and structuredContent', async () => {
			// Arrange
			execute.mockResolvedValue({
				success: true,
				result: { context: '3 dependents', message: 'Impact checked' },
			});

			// Act
			const result = await callHook({ event: 'PostToolUse', input: {} });

			// Assert
			expect(result.structuredContent).toEqual({
				hookSpecificOutput: {
					hookEventName: 'PostToolUse',
					additionalContext: '3 dependents',
				},
				systemMessage: 'Impact checked',
			});
			expect(result.content).toEqual([
				{ type: 'text', text: JSON.stringify(result.structuredContent) },
			]);
			expect(result.isError).toBeUndefined();
			expect(() =>
				HookOutputSchema.parse(result.structuredContent),
			).not.toThrow();
		});

		it('should drop decision, block and rewrite fields from the program value', async () => {
			// Arrange
			execute.mockResolvedValue({
				success: true,
				result: {
					context: 'note',
					decision: 'block',
					permissionDecision: 'deny',
					continue: false,
					updatedInput: { command: 'rm -rf /' },
				},
			});

			// Act
			const result = await callHook({ event: 'PreToolUse', input: {} });

			// Assert
			expect(result.structuredContent).toEqual({
				hookSpecificOutput: {
					hookEventName: 'PreToolUse',
					additionalContext: 'note',
				},
			});
		});

		it('should pass the parsed hook context to the runtime', async () => {
			// Arrange
			const sessionId = freshSessionId();
			hookOnceStore.commit(sessionId, ['seen']);
			execute.mockResolvedValue({ success: true, result: null });

			// Act
			await callHook({
				event: 'SessionStart',
				input: { source: 'startup' },
				sessionId,
			});

			// Assert
			expect(execute.mock.calls[0][0].hook).toEqual({
				event: 'SessionStart',
				input: { source: 'startup' },
				sessionId,
				settings: {},
				claimed: ['seen'],
			});
		});
	});

	describe('once keys', () => {
		it('should commit claimed keys when the output is non-empty', async () => {
			// Arrange
			const sessionId = freshSessionId();
			execute.mockResolvedValue({
				success: true,
				result: { message: 'Indexed' },
				claimedKeys: ['notice'],
			});

			// Act
			await callHook({ event: 'SessionStart', input: {}, sessionId });

			// Assert
			expect([...hookOnceStore.claimed(sessionId)]).toEqual(['notice']);
		});

		it('should not commit claimed keys when the output is empty', async () => {
			// Arrange
			const sessionId = freshSessionId();
			execute.mockResolvedValue({
				success: true,
				result: { message: '' },
				claimedKeys: ['notice'],
			});

			// Act
			await callHook({ event: 'SessionStart', input: {}, sessionId });

			// Assert
			expect(hookOnceStore.claimed(sessionId).size).toBe(0);
		});

		it('should not commit claimed keys when execution fails', async () => {
			// Arrange
			const sessionId = freshSessionId();
			execute.mockResolvedValue({
				success: false,
				error: 'soft failure',
				claimedKeys: ['notice'],
			});

			// Act
			await callHook({ event: 'SessionStart', input: {}, sessionId });

			// Assert
			expect(hookOnceStore.claimed(sessionId).size).toBe(0);
		});
	});

	describe('settings', () => {
		it('should never pass CONSTELLATION_ACCESS_KEY to the runtime', async () => {
			// Arrange
			process.env.CONSTELLATION_ACCESS_KEY = 'ak:secret';
			process.env.CONSTELLATION_HOOK_MODE = 'verbose';
			execute.mockResolvedValue({ success: true, result: null });

			// Act
			await callHook({
				event: 'PostToolUse',
				input: {},
				settings: ['CONSTELLATION_ACCESS_KEY', 'CONSTELLATION_HOOK_MODE'],
			});

			// Assert
			const settings = execute.mock.calls[0][0].hook?.settings;
			expect(settings).toEqual({ CONSTELLATION_HOOK_MODE: 'verbose' });
			expect(JSON.stringify(execute.mock.calls[0][0])).not.toContain(
				'ak:secret',
			);
		});
	});
});
