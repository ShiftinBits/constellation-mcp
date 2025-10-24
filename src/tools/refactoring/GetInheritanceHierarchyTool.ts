/**
 * Get Inheritance Hierarchy Tool
 *
 * MCP tool for analyzing class inheritance hierarchies, interfaces, and type relationships
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface GetInheritanceHierarchyParams {
	symbolId?: string;
	className?: string;
	filePath?: string;
	direction?: 'ancestors' | 'descendants' | 'both';
	depth?: number;
	filterByRelationshipType?: string[];
	includeGraph?: boolean;
}

interface ClassNode {
	name: string;
	qualifiedName: string;
	filePath: string;
	line: number;
	kind: 'class' | 'interface' | 'abstract-class' | 'type';
	visibility: 'public' | 'private' | 'protected' | 'internal';
	isAbstract: boolean;
	members: {
		methods: number;
		properties: number;
		abstractMethods: number;
	};
}

interface InheritanceRelation {
	from: ClassNode;
	to: ClassNode;
	type: 'extends' | 'implements' | 'uses';
}

interface GetInheritanceHierarchyResult {
	root: ClassNode;
	hierarchy: {
		ancestors: ClassNode[];
		descendants: ClassNode[];
		siblings: ClassNode[];
		interfaces: ClassNode[];
		implementations: ClassNode[];
	};
	relations: InheritanceRelation[];
	analysis: {
		depth: number;
		breadth: number;
		totalClasses: number;
		complexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'DEEP';
		issues: string[];
		recommendations: string[];
	};
	diagram: string;
}

class GetInheritanceHierarchyTool extends BaseMcpTool<
	GetInheritanceHierarchyParams,
	GetInheritanceHierarchyResult
> {
	name = 'get_inheritance_hierarchy';
	description =
		'Analyze class inheritance hierarchies, interfaces, and type relationships. Visualize the object-oriented structure and identify design issues. ' +
		'**PAGINATION**: Supports limit/offset with default of 20. Use for base classes with many subclasses or deep inheritance trees. ' +
		'Increase limit (50-100) for widely-extended base classes or comprehensive hierarchy analysis.';

	schema = {
		symbolId: {
			type: z.string().optional(),
			description:
				'Unique symbol identifier (from search results). Required if className not provided.',
		},
		className: {
			type: z.string().optional(),
			description:
				'Name of class to analyze (e.g., "UserService"). Required if symbolId not provided.',
		},
		filePath: {
			type: z.string().optional(),
			description:
				'Path to file containing class (e.g., "src/models/User.ts"). Optional - helps resolve ambiguity.',
		},
		direction: {
			type: z.enum(['ancestors', 'descendants', 'both']).optional().default('both'),
			description:
				'Direction to traverse: ancestors (parent classes), descendants (child classes), or both (default: both)',
		},
		depth: {
			type: z.coerce.number().int().min(1).max(20).optional(),
			description:
				'Maximum depth to traverse in hierarchy (default: unlimited, max: 20)',
		},
		filterByRelationshipType: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by relationship type (e.g., ["extends", "implements"])',
		},
		includeGraph: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include graph visualization data (default: false)',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(100).optional().default(20),
			description:
				'Maximum number of hierarchy nodes to return per page (default: 20, max: 100). Applies to ancestors and descendants combined. Use 50-100 for base classes with many subclasses.',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Starting position for pagination (default: 0). Useful for exploring large class hierarchies. Example: limit=20, offset=20 gets hierarchy nodes 21-40.',
		},
	};

	// No parameter transformation needed - direct passthrough to API

	/**
	 * Format the inheritance hierarchy for AI-friendly output
	 */
	protected formatResult(
		data: GetInheritanceHierarchyResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data || !data.root) {
			return 'Error: No hierarchy data returned from API';
		}

		const { root, ancestors, descendants } = data;

		let output = `Inheritance Hierarchy: ${root?.name || 'unknown'}\n\n`;

		// Root class info
		output += `## Root Class\n`;
		output += `Name: ${root?.name || 'unknown'}\n`;
		output += `File: ${root?.filePath || 'unknown'}\n`;
		output += `Type: ${root?.kind || 'class'}\n`;

		// Calculate hierarchy metrics
		const ancestorCount = ancestors?.length || 0;
		const descendantCount = descendants?.length || 0;
		const totalClasses = 1 + ancestorCount + descendantCount;
		const maxDepth = Math.max(
			...(ancestors?.map(a => a.depth) || [0]),
			...(descendants?.map(d => d.depth) || [0])
		);

		// Analysis
		output += `\n## Hierarchy Analysis\n`;
		output += `Depth: ${maxDepth} levels\n`;
		output += `Ancestors: ${ancestorCount}\n`;
		output += `Descendants: ${descendantCount}\n`;
		output += `Total Classes: ${totalClasses}\n`;

		// Ancestors (parent classes)
		if (ancestors && ancestors.length > 0) {
			output += `\n## Ancestors (${ancestors.length})\n`;
			output += `Classes that ${root?.name || 'this class'} extends:\n\n`;
			for (const ancestor of ancestors) {
				output += `  ${this.getKindIcon(ancestor?.kind || 'class')} ${ancestor?.name || 'unknown'}\n`;
				output += `     ${ancestor?.filePath || 'unknown'}\n`;
				output += `     Relationship: ${ancestor?.relationshipType || 'extends'}\n`;
				output += `     Depth: ${ancestor?.depth || 0}\n`;
			}
			output += '\n';
		}

		// Descendants (child classes)
		if (descendants && descendants.length > 0) {
			output += `## Descendants (${descendants.length})\n`;
			output += `Classes that extend ${root?.name || 'this class'}:\n\n`;

			for (const desc of descendants.slice(0, 20)) {
				output += `  ${this.getKindIcon(desc?.kind || 'class')} ${desc?.name || 'unknown'}\n`;
				output += `     ${desc?.filePath || 'unknown'}\n`;
			}
			if (descendants.length > 20) {
				output += `  ... and ${descendants.length - 20} more\n`;
			}
			output += '\n';
		}

		// Design patterns and best practices
		if (maxDepth > 4 || descendantCount > 20) {
			output += `## ⚠️  Design Recommendations\n\n`;

			if (maxDepth > 4) {
				output += `**Deep Hierarchy Warning:**\n`;
				output += `- Hierarchy is ${maxDepth} levels deep\n`;
				output += `- Consider flattening to improve maintainability\n`;
				output += `- Favor composition over inheritance\n\n`;
			}

			if (descendantCount > 20) {
				output += `**Many Subclasses:**\n`;
				output += `- ${descendantCount} classes inherit from ${root?.name}\n`;
				output += `- Ensure base class contract is stable\n`;
				output += `- Changes to base class affect many classes\n\n`;
			}
		}

		output += `## 📚 Best Practices\n\n`;
		output += `**Liskov Substitution Principle:**\n`;
		output += `- Subtypes must be substitutable for their base types\n`;
		output += `- Ensure child classes don't break parent contracts\n\n`;

		output += `**When to Use Inheritance:**\n`;
		output += `- True "is-a" relationships (Dog is-a Animal)\n`;
		output += `- Shared behavior and state across subclasses\n`;
		output += `- When polymorphism is beneficial\n`;

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}

	private getKindIcon(kind: string): string {
		switch (kind) {
			case 'class':
				return '🏛️';
			case 'abstract-class':
				return '🏛️✨';
			case 'interface':
				return '📋';
			case 'type':
				return '🏷️';
			default:
				return '📦';
		}
	}

	private getComplexityEmoji(complexity: string): string {
		switch (complexity) {
			case 'SIMPLE':
				return '🟢';
			case 'MODERATE':
				return '🟡';
			case 'COMPLEX':
				return '🟠';
			case 'DEEP':
				return '🔴';
			default:
				return '⚪';
		}
	}
}

export default GetInheritanceHierarchyTool;
