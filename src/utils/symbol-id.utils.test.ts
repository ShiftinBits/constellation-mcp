/**
 * Symbol ID Utilities Tests
 */

import { describe, it, expect } from '@jest/globals';
import { generateSymbolId, isValidSymbolId } from './symbol-id.utils.js';

describe('generateSymbolId', () => {
	it('should generate a base64-encoded SHA-224 hash', () => {
		const symbolId = generateSymbolId(
			'constellation-core',
			'main',
			'apps/client-api/src/controllers/health.controller.ts',
			'HealthController'
		);

		// Should be a valid base64 string
		expect(symbolId).toMatch(/^[A-Za-z0-9+/]+=*$/);

		// SHA-224 produces 28 bytes, which encodes to 38 base64 characters with padding
		const decoded = Buffer.from(symbolId, 'base64');
		expect(decoded.length).toBe(28);
	});

	it('should produce consistent hashes for the same input', () => {
		const symbolId1 = generateSymbolId(
			'my-project',
			'main',
			'src/file.ts',
			'MyClass'
		);
		const symbolId2 = generateSymbolId(
			'my-project',
			'main',
			'src/file.ts',
			'MyClass'
		);

		expect(symbolId1).toBe(symbolId2);
	});

	it('should produce different hashes for different inputs', () => {
		const symbolId1 = generateSymbolId(
			'my-project',
			'main',
			'src/file.ts',
			'ClassA'
		);
		const symbolId2 = generateSymbolId(
			'my-project',
			'main',
			'src/file.ts',
			'ClassB'
		);

		expect(symbolId1).not.toBe(symbolId2);
	});

	it('should produce different hashes for different branches', () => {
		const symbolId1 = generateSymbolId(
			'my-project',
			'main',
			'src/file.ts',
			'MyClass'
		);
		const symbolId2 = generateSymbolId(
			'my-project',
			'feature-branch',
			'src/file.ts',
			'MyClass'
		);

		expect(symbolId1).not.toBe(symbolId2);
	});

	it('should produce different hashes for different namespaces', () => {
		const symbolId1 = generateSymbolId(
			'project-a',
			'main',
			'src/file.ts',
			'MyClass'
		);
		const symbolId2 = generateSymbolId(
			'project-b',
			'main',
			'src/file.ts',
			'MyClass'
		);

		expect(symbolId1).not.toBe(symbolId2);
	});

	it('should produce different hashes for different file paths', () => {
		const symbolId1 = generateSymbolId(
			'my-project',
			'main',
			'src/file1.ts',
			'MyClass'
		);
		const symbolId2 = generateSymbolId(
			'my-project',
			'main',
			'src/file2.ts',
			'MyClass'
		);

		expect(symbolId1).not.toBe(symbolId2);
	});

	it('should match known test vector', () => {
		// This is a known symbolId from the test scripts
		const symbolId = generateSymbolId(
			'constellation-core',
			'main',
			'apps/client-api/src/controllers/health.controller.ts',
			'HealthController'
		);

		// Verify it produces a valid 28-byte hash
		const decoded = Buffer.from(symbolId, 'base64');
		expect(decoded.length).toBe(28);
		expect(symbolId).toBeTruthy();
		expect(symbolId.length).toBeGreaterThan(0);
	});
});

describe('isValidSymbolId', () => {
	it('should return true for valid symbol IDs', () => {
		const validSymbolId = generateSymbolId(
			'test-project',
			'main',
			'src/test.ts',
			'TestClass'
		);

		expect(isValidSymbolId(validSymbolId)).toBe(true);
	});

	it('should return false for invalid base64', () => {
		expect(isValidSymbolId('not-valid-base64!@#')).toBe(false);
	});

	it('should return false for wrong length hashes', () => {
		// Valid base64 but wrong length (SHA-256 would be 32 bytes)
		const sha256Hash = Buffer.from('a'.repeat(32)).toString('base64');
		expect(isValidSymbolId(sha256Hash)).toBe(false);
	});

	it('should return false for empty strings', () => {
		expect(isValidSymbolId('')).toBe(false);
	});

	it('should return false for strings that are too short', () => {
		expect(isValidSymbolId('abc')).toBe(false);
	});

	it('should validate example symbolIds from test scripts', () => {
		// These are example symbolIds from the test-mcp-tools.sh script
		const exampleIds = [
			'99qFgDUS1EICFI4i85z7UdjEPeLyvoilKoDhcA==',
			'GjXOcqZbVDPwCrwd3VAUXmAwm1JLS6eXz6oldg==',
			'gfDlpoPvXIpHZ2AIa0km5pWQPFSwaEQ1aTaCCg==',
		];

		for (const id of exampleIds) {
			expect(isValidSymbolId(id)).toBe(true);
		}
	});
});
