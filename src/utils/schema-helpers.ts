/**
 * Schema Helper Utilities
 *
 * Shared Zod schema helpers for MCP tools
 */

import { z } from 'zod';

/**
 * Properly convert string booleans to actual booleans
 *
 * The MCP framework sends boolean parameters as strings ("true"/"false")
 * instead of actual boolean values. Using z.coerce.boolean() is buggy
 * because JavaScript's Boolean() constructor treats ANY non-empty string
 * as truthy:
 *
 * @example
 * ```typescript
 * Boolean("false") → true  // ❌ Bug! Any non-empty string is truthy
 * Boolean("true")  → true  // ✅
 * Boolean(false)   → false // ✅
 * Boolean(true)    → true  // ✅
 * ```
 *
 * This helper properly converts string "false"/"true" to boolean values:
 *
 * @example
 * ```typescript
 * booleanSchema.parse("false") → false // ✅ Correct
 * booleanSchema.parse("true")  → true  // ✅ Correct
 * booleanSchema.parse(false)   → false // ✅ Correct
 * booleanSchema.parse(true)    → true  // ✅ Correct
 * ```
 */
export const booleanSchema = z.preprocess(
	(val) => {
		if (typeof val === 'string') {
			return val.toLowerCase() === 'true';
		}
		return val;
	},
	z.boolean()
);
