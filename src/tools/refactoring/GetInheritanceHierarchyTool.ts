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
		'Analyze class inheritance hierarchies, interfaces, and type relationships. Visualize the object-oriented structure and identify design issues.';

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

		const { root, hierarchy, relations, analysis, diagram } = data;
		const hierarchyData = hierarchy || {};
		const analysisData = analysis || {};

		let output = `Inheritance Hierarchy: ${root?.name || 'unknown'}\n\n`;

		// Root class info
		output += `## Root Class\n`;
		output += `Name: ${root?.qualifiedName || root?.name || 'unknown'}\n`;
		output += `File: ${root?.filePath || 'unknown'}:${root?.line || 0}\n`;
		output += `Type: ${root?.kind || 'class'}\n`;
		output += `Visibility: ${root?.visibility || 'public'}\n`;
		if (root?.isAbstract) {
			output += `Abstract: Yes\n`;
		}
		if (root?.members) {
			output += `Members: ${root.members.methods || 0} methods, ${root.members.properties || 0} properties\n`;
			if ((root.members.abstractMethods || 0) > 0) {
				output += `Abstract Methods: ${root.members.abstractMethods}\n`;
			}
		}

		// Analysis
		output += `\n## Hierarchy Analysis\n`;
		output += `Depth: ${analysisData?.depth || 0} levels\n`;
		output += `Breadth: ${analysisData?.breadth || 0} classes at widest level\n`;
		output += `Total Classes: ${analysisData?.totalClasses || 0}\n`;
		output += `Complexity: ${this.getComplexityEmoji(analysisData?.complexity || 'SIMPLE')} ${analysisData?.complexity || 'SIMPLE'}\n`;

		// Issues
		const issues = analysisData?.issues || [];
		if (issues.length > 0) {
			output += `\n### ⚠️  Issues (${issues.length})\n`;
			for (const issue of issues) {
				output += `  • ${issue}\n`;
			}
		}

		// Hierarchy visualization
		output += `\n## Hierarchy Diagram\n`;
		output += '```\n';
		output += diagram || 'No diagram available';
		output += '\n```\n';

		// Ancestors (parent classes)
		const ancestors = hierarchyData?.ancestors || [];
		if (ancestors.length > 0) {
			output += `\n## Ancestors (${ancestors.length})\n`;
			output += `Classes that ${root?.name || 'this class'} extends:\n\n`;
			for (const ancestor of ancestors) {
				output += `  ${this.getKindIcon(ancestor?.kind || 'class')} ${ancestor?.qualifiedName || ancestor?.name || 'unknown'}\n`;
				output += `     ${ancestor?.filePath || 'unknown'}:${ancestor?.line || 0}\n`;
				if (ancestor?.isAbstract) {
					output += `     Abstract class\n`;
				}
			}
			output += '\n';
		}

		// Interfaces
		const interfaces = hierarchyData?.interfaces || [];
		if (interfaces.length > 0) {
			output += `## Interfaces (${interfaces.length})\n`;
			output += `Interfaces that ${root?.name || 'this class'} implements:\n\n`;
			for (const iface of interfaces) {
				output += `  📋 ${iface?.qualifiedName || iface?.name || 'unknown'}\n`;
				output += `     ${iface?.filePath || 'unknown'}:${iface?.line || 0}\n`;
			}
			output += '\n';
		}

		// Descendants (child classes)
		const descendants = hierarchyData?.descendants || [];
		if (descendants.length > 0) {
			output += `## Descendants (${descendants.length})\n`;
			output += `Classes that extend ${root?.name || 'this class'}:\n\n`;

			for (const desc of descendants.slice(0, 10)) {
				output += `  ${this.getKindIcon(desc?.kind || 'class')} ${desc?.qualifiedName || desc?.name || 'unknown'}\n`;
				output += `     ${desc?.filePath || 'unknown'}:${desc?.line || 0}\n`;
			}
			if (descendants.length > 10) {
				output += `  ... and ${descendants.length - 10} more\n`;
			}
			output += '\n';
		}

		// Siblings
		const siblings = hierarchyData?.siblings || [];
		if (siblings.length > 0) {
			output += `## Siblings (${siblings.length})\n`;
			output += `Classes that share the same parent:\n\n`;
			for (const sibling of siblings.slice(0, 10)) {
				output += `  ${this.getKindIcon(sibling?.kind || 'class')} ${sibling?.qualifiedName || sibling?.name || 'unknown'}\n`;
				output += `     ${sibling?.filePath || 'unknown'}:${sibling?.line || 0}\n`;
			}
			if (siblings.length > 10) {
				output += `  ... and ${siblings.length - 10} more\n`;
			}
			output += '\n';
		}

		// Implementations
		const implementations = hierarchyData?.implementations || [];
		if (implementations.length > 0) {
			output += `## All Implementations (${implementations.length})\n`;
			output += `If ${root?.name || 'this'} is an interface, these classes implement it:\n\n`;
			for (const impl of implementations.slice(0, 10)) {
				output += `  ${this.getKindIcon(impl?.kind || 'class')} ${impl?.qualifiedName || impl?.name || 'unknown'}\n`;
				output += `     ${impl?.filePath || 'unknown'}:${impl?.line || 0}\n`;
			}
			if (implementations.length > 10) {
				output += `  ... and ${implementations.length - 10} more\n`;
			}
			output += '\n';
		}

		// Recommendations
		const recommendations = analysisData?.recommendations || [];
		if (recommendations.length > 0) {
			output += `## 💡 Recommendations\n\n`;
			for (let i = 0; i < recommendations.length; i++) {
				output += `${i + 1}. ${recommendations[i]}\n`;
			}
			output += '\n';
		}

		// Design patterns and best practices
		output += `## 📚 Design Patterns & Best Practices\n\n`;
		output += `**Favor Composition Over Inheritance:**\n`;
		output += `- Deep hierarchies (>4 levels) are hard to maintain\n`;
		output += `- Consider using composition or mixins instead\n\n`;

		output += `**Liskov Substitution Principle:**\n`;
		output += `- Subtypes must be substitutable for their base types\n`;
		output += `- Ensure child classes don't break parent contracts\n\n`;

		output += `**Interface Segregation:**\n`;
		output += `- Prefer small, focused interfaces\n`;
		output += `- Classes shouldn't implement unused methods\n\n`;

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
