/**
 * Constellation Guide Prompt Registration Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerConstellationGuidePrompt } from '../../../src/prompts/constellation-guide-prompt.js';

describe('registerConstellationGuidePrompt', () => {
	let mockServer: any;
	let registeredHandler: any;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mock MCP server
		mockServer = {
			registerPrompt: jest.fn((name, config, handler) => {
				registeredHandler = handler;
			}),
		};

		// Register the prompt
		registerConstellationGuidePrompt(mockServer);
	});

	describe('prompt registration', () => {
		it('should register constellation-guide prompt with server', () => {
			expect(mockServer.registerPrompt).toHaveBeenCalledWith(
				'constellation-guide',
				expect.objectContaining({
					title: expect.any(String),
					description: expect.any(String),
				}),
				expect.any(Function)
			);
		});

		it('should register with proper title', () => {
			const call = mockServer.registerPrompt.mock.calls[0];
			const config = call[1];

			expect(config.title).toContain('Constellation');
			expect(config.title).toContain('Guide');
		});

		it('should register with empty args schema', () => {
			const call = mockServer.registerPrompt.mock.calls[0];
			const config = call[1];

			expect(config.argsSchema).toEqual({});
		});

		it('should provide a description', () => {
			const call = mockServer.registerPrompt.mock.calls[0];
			const config = call[1];

			expect(config.description).toBeDefined();
			expect(config.description.length).toBeGreaterThan(0);
		});
	});

	describe('prompt handler', () => {
		it('should return messages array', async () => {
			const result = await registeredHandler();

			expect(result).toHaveProperty('messages');
			expect(Array.isArray(result.messages)).toBe(true);
		});

		it('should return at least one message', async () => {
			const result = await registeredHandler();

			expect(result.messages.length).toBeGreaterThan(0);
		});

		it('should have user role message', async () => {
			const result = await registeredHandler();

			const userMessage = result.messages.find((m: any) => m.role === 'user');
			expect(userMessage).toBeDefined();
		});

		it('should have text content in message', async () => {
			const result = await registeredHandler();

			const message = result.messages[0];
			expect(message.content).toHaveProperty('type', 'text');
			expect(message.content).toHaveProperty('text');
			expect(typeof message.content.text).toBe('string');
		});

		it('should provide substantial guide content', async () => {
			const result = await registeredHandler();

			const message = result.messages[0];
			const text = message.content.text;

			// Should be comprehensive guide
			expect(text.length).toBeGreaterThan(500);
		});

		it('should mention Constellation in guide', async () => {
			const result = await registeredHandler();

			const message = result.messages[0];
			const text = message.content.text;

			expect(text.toLowerCase()).toContain('constellation');
		});

		it('should mention tools or symbols in guide', async () => {
			const result = await registeredHandler();

			const message = result.messages[0];
			const text = message.content.text;

			const hasToolsOrSymbols =
				text.toLowerCase().includes('tool') ||
				text.toLowerCase().includes('symbol');

			expect(hasToolsOrSymbols).toBe(true);
		});

		it('should mention search or discovery in guide', async () => {
			const result = await registeredHandler();

			const message = result.messages[0];
			const text = message.content.text;

			const hasSearchOrDiscovery =
				text.toLowerCase().includes('search') ||
				text.toLowerCase().includes('discover');

			expect(hasSearchOrDiscovery).toBe(true);
		});

		it('should provide structured guidance', async () => {
			const result = await registeredHandler();

			const message = result.messages[0];
			const text = message.content.text;

			// Should have headers or bullet points
			const hasStructure =
				text.includes('#') ||
				text.includes('*') ||
				text.includes('-') ||
				text.includes('1.');

			expect(hasStructure).toBe(true);
		});

		it('should provide tool or method names', async () => {
			const result = await registeredHandler();

			const message = result.messages[0];
			const text = message.content.text;

			// Should mention tool names (snake_case in the guide)
			const hasToolNames =
				text.includes('search_symbols') ||
				text.includes('get_symbol_details') ||
				text.includes('get_dependencies') ||
				text.includes('symbol') ||
				text.includes('dependenc');

			expect(hasToolNames).toBe(true);
		});

		it('should be callable multiple times', async () => {
			const result1 = await registeredHandler();
			const result2 = await registeredHandler();

			expect(result1.messages[0].content.text).toBe(result2.messages[0].content.text);
		});

		it('should not require any arguments', async () => {
			// Handler should work with no args
			const result = await registeredHandler();
			expect(result.messages).toBeDefined();
		});
	});

	describe('guide content structure', () => {
		it('should provide well-structured guide text', async () => {
			const result = await registeredHandler();
			const text = result.messages[0].content.text;

			// Should have some structure (sections, lists, etc.)
			// At minimum, should have multiple paragraphs
			const paragraphs = text.split('\n\n').filter((p: string) => p.trim().length > 0);
			expect(paragraphs.length).toBeGreaterThan(1);
		});

		it('should not be empty', async () => {
			const result = await registeredHandler();
			const text = result.messages[0].content.text;

			expect(text.trim()).not.toBe('');
		});

		it('should not contain template placeholders', async () => {
			const result = await registeredHandler();
			const text = result.messages[0].content.text;

			// Check for common placeholder patterns
			expect(text).not.toContain('{{');
			expect(text).not.toContain('}}');
			expect(text).not.toContain('${');
			expect(text).not.toContain('TODO');
			expect(text).not.toContain('FIXME');
		});
	});
});
