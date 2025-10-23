/**
 * Symbol ID Utilities
 *
 * Provides utilities for generating symbol IDs compatible with the Constellation API.
 * Symbol IDs are SHA-224 hashes of namespace:branch:filePath:symbolName encoded as base64.
 */

import * as crypto from 'node:crypto';

/**
 * Generate a symbol ID from its constituent parts
 *
 * Creates a unique identifier for a code symbol by hashing its fully-qualified location.
 * The format matches the server-side implementation in base-extractor.ts
 *
 * @param namespace - Project namespace (from config)
 * @param branch - Git branch name (from config)
 * @param filePath - Relative file path from project root
 * @param symbolName - Name of the symbol (class, function, variable, etc.)
 * @returns Base64-encoded SHA-224 hash
 *
 * @example
 * ```typescript
 * const symbolId = generateSymbolId(
 *   'my-project',
 *   'main',
 *   'src/controllers/health.controller.ts',
 *   'HealthController'
 * );
 * // Returns: "99qFgDUS1EICFI4i85z7UdjEPeLyvoilKoDhcA=="
 * ```
 */
export function generateSymbolId(
	namespace: string,
	branch: string,
	filePath: string,
	symbolName: string,
): string {
	// Construct the input string in the same format as the server
	const input = `${namespace}:${branch}:${filePath}:${symbolName}`;

	// Hash with SHA-224 and encode as base64
	return crypto.hash('SHA-224', input, 'base64');
}

/**
 * Validate that a string is a properly formatted symbol ID
 *
 * Checks if the provided string is a valid base64-encoded SHA-224 hash.
 * SHA-224 produces 28 bytes, which encodes to 38 base64 characters with padding.
 *
 * @param symbolId - String to validate
 * @returns True if the string is a valid symbol ID format
 *
 * @example
 * ```typescript
 * isValidSymbolId('99qFgDUS1EICFI4i85z7UdjEPeLyvoilKoDhcA==') // true
 * isValidSymbolId('invalid') // false
 * ```
 */
export function isValidSymbolId(symbolId: string): boolean {
	// Check if it's valid base64
	const base64Regex = /^[A-Za-z0-9+/]+=*$/;
	if (!base64Regex.test(symbolId)) {
		return false;
	}

	// Check if it decodes to exactly 28 bytes (SHA-224 output size)
	try {
		const decoded = Buffer.from(symbolId, 'base64');
		return decoded.length === 28;
	} catch {
		return false;
	}
}
