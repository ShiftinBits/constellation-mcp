/**
 * Contextual Symbol Resolution Tool
 *
 * MCP tool for resolving symbols with full context including imports, scope, type information, and usage
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';

interface ContextualSymbolResolutionParams {
	symbolId?: string;
	qualifiedName?: string;
	symbolName?: string;
	filePath?: string;
	includeDependencies?: boolean;
	includeDependents?: boolean;
	depth?: number;
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
		symbolId: {
			type: z.string().optional(),
			description: 'Unique symbol identifier (alternative)',
		},
		qualifiedName: {
			type: z.string().optional(),
			description: 'Fully qualified symbol name (alternative)',
		},
		symbolName: {
			type: z.string().optional(),
			description:
				'Symbol name to resolve (e.g., "getUserById", "User", "API_KEY")',
		},
		filePath: {
			type: z.string().optional(),
			description:
				'File path (optional, improves precision when multiple symbols have same name)',
		},
		includeDependencies: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include dependencies (default: true)',
		},
		includeDependents: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include dependents (default: true)',
		},
		depth: {
			type: z.coerce.number().int().min(1).max(3).optional().default(1),
			description: 'Dependency depth to analyze (default: 1, max: 3)',
		},
	};

	// No parameter transformation needed - direct passthrough to API

	/**
	 * Format the contextual symbol resolution for AI-friendly output
	 */
	protected formatResult(
		data: ContextualSymbolResolutionResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive check
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { symbol, dependencies, dependents, summary } = data;

		let output = `Symbol Resolution: ${symbol.name}\n\n`;

		// Resolved symbol
		output += `## Definition\n`;
		output += `Name: ${symbol.qualifiedName}\n`;
		output += `Kind: ${symbol.kind}\n`;
		output += `Location: ${symbol.filePath}:${symbol.line}:${symbol.column}\n`;
		output += `Exported: ${symbol.isExported ? 'Yes' : 'No'}\n`;

		if (symbol.visibility) {
			output += `Visibility: ${symbol.visibility}\n`;
		}

		if (symbol.modifiers && symbol.modifiers.length > 0) {
			output += `Modifiers: ${symbol.modifiers.join(', ')}\n`;
		}

		if (symbol.signature) {
			output += `\nSignature:\n`;
			output += '```\n';
			output += symbol.signature;
			output += '\n```\n';
		}

		if (symbol.documentation) {
			output += `\nDocumentation:\n${symbol.documentation}\n`;
		}

		// Type information
		if (symbol.typeInfo) {
			output += `\n## Type Information\n`;
			output += JSON.stringify(symbol.typeInfo, null, 2);
			output += '\n';
		}

		// Decorators
		if (symbol.decorators && Array.isArray(symbol.decorators) && symbol.decorators.length > 0) {
			output += `\nDecorators: ${symbol.decorators.join(', ')}\n`;
		}

		// Dependencies (what this symbol uses)
		const depsArray = dependencies || [];
		if (depsArray.length > 0) {
			output += `\n## Dependencies (${depsArray.length})\n`;
			output += `What this symbol uses:\n\n`;

			// Group by depth
			const byDepth = new Map<number, typeof depsArray>();
			for (const dep of depsArray) {
				if (!byDepth.has(dep.depth)) {
					byDepth.set(dep.depth, []);
				}
				byDepth.get(dep.depth)!.push(dep);
			}

			for (const [depth, deps] of Array.from(byDepth.entries()).sort(([a], [b]) => a - b)) {
				output += `### Depth ${depth} (${depth === 1 ? 'Direct' : 'Transitive'})\n`;
				for (const dep of deps.slice(0, 10)) {
					output += `  ${dep.name} (${dep.kind})\n`;
					output += `    ${dep.filePath}:${dep.line}\n`;
					output += `    Via: ${dep.relationshipType}\n`;
					output += '\n';
				}
				if (deps.length > 10) {
					output += `  ... and ${deps.length - 10} more at depth ${depth}\n\n`;
				}
			}
		}

		// Dependents (what uses this symbol)
		const depsntArray = dependents || [];
		if (depsntArray.length > 0) {
			output += `\n## Dependents (${depsntArray.length})\n`;
			output += `What uses this symbol:\n\n`;

			// Group by depth
			const byDepth = new Map<number, typeof depsntArray>();
			for (const dep of depsntArray) {
				if (!byDepth.has(dep.depth)) {
					byDepth.set(dep.depth, []);
				}
				byDepth.get(dep.depth)!.push(dep);
			}

			for (const [depth, deps] of Array.from(byDepth.entries()).sort(([a], [b]) => a - b)) {
				output += `### Depth ${depth} (${depth === 1 ? 'Direct' : 'Transitive'})\n`;
				for (const dep of deps.slice(0, 10)) {
					output += `  ${dep.name} (${dep.kind})\n`;
					output += `    ${dep.filePath}:${dep.line}\n`;
					output += `    Via: ${dep.relationshipType}\n`;
					output += '\n';
				}
				if (deps.length > 10) {
					output += `  ... and ${deps.length - 10} more at depth ${depth}\n\n`;
				}
			}
		}

		// Summary statistics
		output += `\n## Summary\n`;
		output += `Direct Dependencies: ${summary.directDependencies}\n`;
		output += `Transitive Dependencies: ${summary.transitiveDependencies}\n`;
		output += `Direct Dependents: ${summary.directDependents}\n`;
		output += `Transitive Dependents: ${summary.transitiveDependents}\n`;

		// Usage guide
		output += `\n## 💡 How to Use This Symbol\n\n`;

		if (symbol.kind === 'function' || symbol.kind === 'method') {
			output += `**As a Function:**\n`;
			if (symbol.signature) {
				output += `\`\`\`\n${symbol.signature}\n\`\`\`\n\n`;
			}
		}

		if (symbol.kind === 'class') {
			output += `**As a Class:**\n`;
			output += `Instantiate with: \`new ${symbol.name}()\`\n\n`;
		}

		if (symbol.isExported) {
			output += `**Import Statement:**\n`;
			output += `\`import { ${symbol.name} } from './${symbol.filePath.replace(/\.[^/.]+$/, '')}';\`\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}

}

export default ContextualSymbolResolutionTool;
