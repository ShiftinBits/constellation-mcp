/**
 * Contextual Symbol Resolution Tool
 *
 * MCP tool for resolving symbols with full context including imports, scope, type information, and usage
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface ContextualSymbolResolutionParams {
	symbolId?: string;
	symbolName: string;
	filePath?: string;
	line?: number;
	includeScope?: boolean;
	includeTypes?: boolean;
	includeUsages?: boolean;
}

interface ScopeInfo {
	type: 'global' | 'module' | 'class' | 'function' | 'block';
	name: string;
	filePath: string;
	range: {
		startLine: number;
		endLine: number;
	};
}

interface TypeInfo {
	declaredType?: string;
	inferredType?: string;
	genericParameters?: string[];
	constraints?: string[];
	returnType?: string;
}

interface ImportInfo {
	importedFrom: string;
	importType: 'named' | 'default' | 'namespace' | 'side-effect';
	originalName?: string;
	isTypeOnly: boolean;
}

interface ResolvedSymbol {
	name: string;
	qualifiedName: string;
	kind: string;
	filePath: string;
	line: number;
	column: number;
	definition: {
		signature: string;
		snippet: string;
		documentation?: string;
	};
	scope: ScopeInfo[];
	type: TypeInfo;
	import?: ImportInfo;
	visibility: 'public' | 'private' | 'protected' | 'internal';
	modifiers: string[];
}

interface ContextualSymbolResolutionResult {
	query: {
		symbolName: string;
		requestedAt?: {
			filePath: string;
			line: number;
		};
	};
	resolved: ResolvedSymbol;
	context: {
		surroundingCode: string;
		relatedSymbols: Array<{
			name: string;
			relationship: string;
			filePath: string;
		}>;
		scope: ScopeInfo;
	};
	usages: Array<{
		filePath: string;
		line: number;
		context: string;
		usageType: 'call' | 'assignment' | 'reference' | 'type-reference';
	}>;
	alternatives: Array<{
		name: string;
		reason: string;
		filePath: string;
	}>;
}

class ContextualSymbolResolutionTool extends BaseMcpTool<
	ContextualSymbolResolutionParams,
	ContextualSymbolResolutionResult
> {
	name = 'contextual_symbol_resolution';
	description =
		'Resolve a symbol with full context including definition, type information, scope, imports, and usage. Essential for understanding how symbols are defined and used.';

	schema = {
		symbolName: {
			type: z.string().min(1),
			description:
				'Name of symbol to resolve (e.g., "getUserById", "User", "API_KEY")',
		},
		filePath: {
			type: z.string().optional(),
			description:
				'Optional: File path where symbol is referenced (helps with disambiguation)',
		},
		line: {
			type: z.coerce.number().optional(),
			description:
				'Optional: Line number where symbol is referenced (provides precise context)',
		},
		includeScope: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include scope chain information (default: true)',
		},
		includeTypes: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include type information (default: true)',
		},
		includeUsages: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include usage examples (default: true)',
		},
	};

	/**
	 * Override execute to generate symbolId from filePath + symbolName if needed
	 */
	async execute(input: ContextualSymbolResolutionParams): Promise<string> {
		// If symbolId not provided but filePath and symbolName are, generate it
		if (!input.symbolId && input.filePath && input.symbolName) {
			const symbolId = this.generateSymbolId(input.filePath, input.symbolName);
			input = { ...input, symbolId };
		}

		return super.execute(input);
	}

	/**
	 * Format the contextual symbol resolution for AI-friendly output
	 */
	protected formatResult(
		data: ContextualSymbolResolutionResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { query, resolved, context, usages, alternatives } = data;

		let output = `Symbol Resolution: ${query.symbolName}\n\n`;

		if (query.requestedAt) {
			output += `Requested from: ${query.requestedAt.filePath}:${query.requestedAt.line}\n\n`;
		}

		// Resolved symbol
		output += `## Definition\n`;
		output += `Name: ${resolved.qualifiedName}\n`;
		output += `Kind: ${resolved.kind}\n`;
		output += `Location: ${resolved.filePath}:${resolved.line}:${resolved.column}\n`;
		output += `Visibility: ${resolved.visibility}\n`;

		if (resolved.modifiers.length > 0) {
			output += `Modifiers: ${resolved.modifiers.join(', ')}\n`;
		}

		output += `\nSignature:\n`;
		output += '```\n';
		output += resolved.definition.signature;
		output += '\n```\n';

		if (resolved.definition.documentation) {
			output += `\nDocumentation:\n${resolved.definition.documentation}\n`;
		}

		// Import information
		if (resolved.import) {
			output += `\n## Import Information\n`;
			output += `Imported from: ${resolved.import.importedFrom}\n`;
			output += `Import type: ${resolved.import.importType}\n`;
			if (resolved.import.originalName) {
				output += `Original name: ${resolved.import.originalName}\n`;
			}
			output += `Type-only import: ${resolved.import.isTypeOnly ? 'Yes' : 'No'}\n`;
		}

		// Type information
		if (resolved.type) {
			output += `\n## Type Information\n`;

			if (resolved.type.declaredType) {
				output += `Declared Type: ${resolved.type.declaredType}\n`;
			}

			if (resolved.type.inferredType) {
				output += `Inferred Type: ${resolved.type.inferredType}\n`;
			}

			if (resolved.type.returnType) {
				output += `Return Type: ${resolved.type.returnType}\n`;
			}

			if (resolved.type.genericParameters && resolved.type.genericParameters.length > 0) {
				output += `Generic Parameters: <${resolved.type.genericParameters.join(', ')}>\n`;
			}

			if (resolved.type.constraints && resolved.type.constraints.length > 0) {
				output += `Constraints:\n`;
				for (const constraint of resolved.type.constraints) {
					output += `  • ${constraint}\n`;
				}
			}
		}

		// Scope chain
		if (resolved.scope.length > 0) {
			output += `\n## Scope Chain\n`;
			for (let i = 0; i < resolved.scope.length; i++) {
				const scope = resolved.scope[i];
				const indent = '  '.repeat(i);
				output += `${indent}${this.getScopeIcon(scope.type)} ${scope.type}: ${scope.name}\n`;
				output += `${indent}   ${scope.filePath}:${scope.range.startLine}-${scope.range.endLine}\n`;
			}
		}

		// Current context
		if (context) {
			output += `\n## Current Context\n`;
			output += `Scope: ${context.scope.type} (${context.scope.name})\n`;

			if (context.relatedSymbols.length > 0) {
				output += `\nRelated Symbols:\n`;
				for (const rel of context.relatedSymbols.slice(0, 10)) {
					output += `  • ${rel.name} (${rel.relationship})\n`;
					output += `    ${rel.filePath}\n`;
				}
			}

			if (context.surroundingCode) {
				output += `\nSurrounding Code:\n`;
				output += '```\n';
				const lines = context.surroundingCode.split('\n');
				for (const line of lines.slice(0, 10)) {
					output += `${line}\n`;
				}
				if (lines.length > 10) {
					output += `... (${lines.length - 10} more lines)\n`;
				}
				output += '```\n';
			}
		}

		// Usages
		if (usages.length > 0) {
			output += `\n## Usages (${usages.length})\n\n`;

			// Group by usage type
			const byType = new Map<string, typeof usages>();
			for (const usage of usages) {
				if (!byType.has(usage.usageType)) {
					byType.set(usage.usageType, []);
				}
				byType.get(usage.usageType)!.push(usage);
			}

			for (const [type, typeUsages] of byType) {
				output += `### ${this.capitalize(type.replace(/-/g, ' '))} (${typeUsages.length})\n`;
				for (const usage of typeUsages.slice(0, 5)) {
					output += `  ${usage.filePath}:${usage.line}\n`;
					output += `  ${usage.context}\n\n`;
				}
				if (typeUsages.length > 5) {
					output += `  ... and ${typeUsages.length - 5} more ${type} usages\n\n`;
				}
			}
		}

		// Alternatives (if symbol is ambiguous)
		if (alternatives.length > 0) {
			output += `## ⚠️  Alternative Matches (${alternatives.length})\n`;
			output += `Multiple symbols with this name exist:\n\n`;

			for (const alt of alternatives) {
				output += `  • ${alt.name}\n`;
				output += `    ${alt.filePath}\n`;
				output += `    ${alt.reason}\n\n`;
			}

			output += `Use filePath and line parameters to disambiguate.\n`;
		}

		// Usage guide
		output += `\n## 💡 How to Use This Symbol\n\n`;

		if (resolved.kind === 'function') {
			output += `**As a Function:**\n`;
			output += `\`\`\`\n${resolved.definition.signature}\n\`\`\`\n\n`;
		}

		if (resolved.kind === 'class') {
			output += `**As a Class:**\n`;
			output += `Instantiate with: \`new ${resolved.name}()\`\n\n`;
		}

		if (resolved.import) {
			output += `**Import Statement:**\n`;
			if (resolved.import.importType === 'named') {
				output += `\`import { ${resolved.name} } from '${resolved.import.importedFrom}';\`\n`;
			} else if (resolved.import.importType === 'default') {
				output += `\`import ${resolved.name} from '${resolved.import.importedFrom}';\`\n`;
			} else if (resolved.import.importType === 'namespace') {
				output += `\`import * as ${resolved.name} from '${resolved.import.importedFrom}';\`\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}

	private getScopeIcon(type: string): string {
		switch (type) {
			case 'global':
				return '🌍';
			case 'module':
				return '📦';
			case 'class':
				return '🏛️';
			case 'function':
				return '⚙️';
			case 'block':
				return '📋';
			default:
				return '•';
		}
	}

	private capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

export default ContextualSymbolResolutionTool;
