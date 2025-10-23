/**
 * Get Symbol Details Tool
 *
 * MCP tool for getting detailed information about a specific symbol including
 * its definition, dependencies, dependents, and usage locations
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import {
	GetSymbolDetailsParams,
	GetSymbolDetailsResult,
} from '../../types/api-types.js';
import {
	formatLocation,
	formatDependencies,
} from '../../utils/format-helpers.js';

class GetSymbolDetailsTool extends BaseMcpTool<
	GetSymbolDetailsParams,
	GetSymbolDetailsResult
> {
	name = 'get_symbol_details';
	description =
		'Get detailed information about a specific symbol (function, class, variable, etc.) including its signature, documentation, dependencies, dependents, and all usage locations.';

	schema = {
		symbolId: {
			type: z.string().optional(),
			description:
				'Unique symbol identifier (from search results). If not provided, both symbolName and filePath are required.',
		},
		symbolName: {
			type: z.string().optional(),
			description: 'Symbol name to look up (required if symbolId not provided)',
		},
		filePath: {
			type: z.string().optional(),
			description:
				'File path containing the symbol (required if symbolId not provided)',
		},
		includeDependencies: {
			type: z.coerce.boolean().optional(),
			description:
				'Include what this symbol depends on (default: true)',
		},
		includeDependents: {
			type: z.coerce.boolean().optional(),
			description:
				'Include what depends on this symbol (default: true)',
		},
		includeUsages: {
			type: z.coerce.boolean().optional(),
			description:
				'Include all locations where this symbol is used (default: true)',
		},
	};

	/**
	 * Override execute to generate symbolId from filePath + symbolName if needed
	 */
	async execute(input: GetSymbolDetailsParams): Promise<string> {
		// If symbolId not provided but filePath and symbolName are, generate it
		if (!input.symbolId && input.filePath && input.symbolName) {
			input.symbolId = this.generateSymbolId(input.filePath, input.symbolName);
		}

		// Validate that we have either symbolId or both filePath + symbolName
		if (!input.symbolId && !(input.filePath && input.symbolName)) {
			return 'Error: Either symbolId OR both filePath and symbolName must be provided';
		}

		return super.execute(input);
	}

	/**
	 * Format the symbol details for AI-friendly output
	 */
	protected formatResult(
		data: GetSymbolDetailsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data || !data.symbol) {
			return 'Error: No symbol data returned from API';
		}

		const { symbol, references, relationships, impactScore } = data;

		const name = symbol?.name || 'unknown';
		let output = `Symbol Details: ${name}\n\n`;

		// Basic info
		output += `Type: ${symbol?.kind || 'unknown'}\n`;
		output += `Location: ${formatLocation(symbol?.filePath || 'unknown', symbol?.line, symbol?.column)}\n`;

		if (symbol?.qualifiedName && symbol.qualifiedName !== symbol.name) {
			output += `Qualified Name: ${symbol.qualifiedName}\n`;
		}

		if (symbol?.signature) {
			output += `Signature: ${symbol.signature}\n`;
		}

		if (symbol?.visibility) {
			output += `Visibility: ${symbol.visibility}\n`;
		}

		if (symbol?.modifiers) {
			const modifiers = Array.isArray(symbol.modifiers) ? symbol.modifiers : [];
			if (modifiers.length > 0) {
				output += `Modifiers: ${modifiers.join(', ')}\n`;
			}
		}

		output += `Exported: ${symbol?.isExported ? 'yes' : 'no'}\n`;

		if (symbol?.isDeprecated) {
			output += `⚠️ Deprecated: yes\n`;
		}

		if (symbol?.decorators) {
			// Handle decorators - can be array or JSON string
			let decorators = [];
			if (Array.isArray(symbol.decorators)) {
				decorators = symbol.decorators;
			} else if (typeof symbol.decorators === 'string') {
				try {
					decorators = JSON.parse(symbol.decorators);
				} catch {
					decorators = [];
				}
			}
			if (decorators.length > 0) {
				output += `Decorators: ${decorators.join(', ')}\n`;
			}
		}

		if (symbol?.documentation) {
			output += `\nDocumentation:\n${symbol.documentation}\n`;
		}

		// References/Usages
		if (references && references.length > 0) {
			output += `\n## References (${references.length} locations)\n\n`;
			for (const ref of references.slice(0, 20)) {
				const location = formatLocation(ref?.filePath || 'unknown', ref?.line);
				const usageType = ref?.usageType || 'reference';
				output += `  ${location} (${usageType})`;
				if (ref?.aliasName) {
					output += ` as ${ref.aliasName}`;
				}
				output += '\n';
			}
			if (references.length > 20) {
				output += `  ... and ${references.length - 20} more\n`;
			}
		}

		// Relationships
		if (relationships) {
			let hasRelationships = false;

			if (relationships.calls && relationships.calls.length > 0) {
				output += `\n## Calls (${relationships.calls.length})\n`;
				for (const call of relationships.calls.slice(0, 10)) {
					output += `  → ${call}\n`;
				}
				if (relationships.calls.length > 10) {
					output += `  ... and ${relationships.calls.length - 10} more\n`;
				}
				hasRelationships = true;
			}

			if (relationships.calledBy && relationships.calledBy.length > 0) {
				output += `\n## Called By (${relationships.calledBy.length})\n`;
				for (const caller of relationships.calledBy.slice(0, 10)) {
					output += `  ← ${caller}\n`;
				}
				if (relationships.calledBy.length > 10) {
					output += `  ... and ${relationships.calledBy.length - 10} more\n`;
				}
				hasRelationships = true;
			}

			if (relationships.inheritsFrom && relationships.inheritsFrom.length > 0) {
				output += `\n## Inherits From\n`;
				for (const parent of relationships.inheritsFrom) {
					output += `  ↑ ${parent}\n`;
				}
				hasRelationships = true;
			}

			if (relationships.inheritedBy && relationships.inheritedBy.length > 0) {
				output += `\n## Inherited By (${relationships.inheritedBy.length})\n`;
				for (const child of relationships.inheritedBy.slice(0, 10)) {
					output += `  ↓ ${child}\n`;
				}
				if (relationships.inheritedBy.length > 10) {
					output += `  ... and ${relationships.inheritedBy.length - 10} more\n`;
				}
				hasRelationships = true;
			}

			if (relationships.children && relationships.children.length > 0) {
				output += `\n## Children (${relationships.children.length})\n`;
				for (const child of relationships.children.slice(0, 10)) {
					output += `  • ${child}\n`;
				}
				if (relationships.children.length > 10) {
					output += `  ... and ${relationships.children.length - 10} more\n`;
				}
				hasRelationships = true;
			}
		}

		// Impact Score
		if (impactScore) {
			output += `\n## Impact Analysis\n`;
			output += `Direct Usage: ${impactScore.directUsage || 0} location${impactScore.directUsage === 1 ? '' : 's'}\n`;
			output += `Transitive Impact: ${impactScore.transitiveImpact || 0}\n`;
			output += `Risk Score: ${impactScore.riskScore || 0}/100 (${impactScore.riskLevel || 'unknown'})\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetSymbolDetailsTool;
