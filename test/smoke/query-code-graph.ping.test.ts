import { describe, expect, it } from '@jest/globals';
import { registerQueryCodeGraphTool } from '../../src/tools/query-code-graph-tool.js';

describe('code_intel ping smoke test', () => {
	it('returns pong from simple code execution', async () => {
		// Minimal mock MCP server to capture the registered handler
		let handler: any;
		const mockServer = {
			registerTool: (_name: string, _config: unknown, h: any) => {
				handler = h;
			},
		} as any;

		// Register tool to get its handler
		registerQueryCodeGraphTool(mockServer);

		// Call the tool with trivial code and cwd so config resolves in this repo
		const result = await handler({
			code: 'return "pong";',
			cwd: process.cwd(),
			timeout: 5000,
		});

		expect(result).toBeDefined();
		expect(result.content?.[0]?.type).toBe('text');
		// Structured content should reflect success and result
		expect(result.structuredContent?.success).toBe(true);
		expect(result.structuredContent?.result).toBe('pong');
		expect(result.isError).toBeUndefined();
	});
});
