/**
 * Tool Definitions Index - Code Mode Only
 *
 * This MCP server exclusively uses Code Mode.
 * All interactions happen through the execute_code tool.
 */

// Code Mode Tool - The only tool we need!
export { executeCodeDefinition } from './execute-code.definition.js';

import { McpToolDefinition } from '../McpToolDefinition.interface';
import { executeCodeDefinition } from './execute-code.definition.js';

/**
 * Array of all tool definitions
 * Code Mode only - single tool for all operations
 */
export const allToolDefinitions: McpToolDefinition[] = [
	executeCodeDefinition,
];

/**
 * Get tool definitions by category
 * Code Mode spans all categories through code execution
 */
export const toolDefinitionsByCategory = {
	CodeMode: [
		executeCodeDefinition,
	],
};

/**
 * Quick reference count
 */
export const toolDefinitionsCount = {
	total: 1,
	description: 'Code Mode Only - Write JavaScript to access all Constellation API capabilities',
};
