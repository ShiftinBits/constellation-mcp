/**
 * Tool Definitions Index - Code Mode Only
 *
 * This MCP server exclusively uses Code Mode.
 * All interactions happen through the query_code tool.
 */

// Code Mode Tool - The only tool we need!
export { queryCodeDefinition } from './query-code.definition.js';

import { McpToolDefinition } from '../McpToolDefinition.interface.js';
import { queryCodeDefinition } from './query-code.definition.js';

/**
 * Array of all tool definitions
 * Code Mode only - single tool for all operations
 */
export const allToolDefinitions: McpToolDefinition[] = [queryCodeDefinition];

/**
 * Get tool definitions by category
 * Code Mode spans all categories through code execution
 */
export const toolDefinitionsByCategory = {
	CodeMode: [queryCodeDefinition],
};

/**
 * Quick reference count
 */
export const toolDefinitionsCount = {
	total: 1,
	description:
		'Code Mode Only - Write JavaScript to access all Constellation API capabilities',
};
