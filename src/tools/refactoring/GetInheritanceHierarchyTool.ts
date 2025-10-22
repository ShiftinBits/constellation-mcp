/**
 * Get Inheritance Hierarchy Tool
 *
 * MCP tool for analyzing class inheritance hierarchies, interfaces, and type relationships
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface GetInheritanceHierarchyParams {
	className?: string;
	filePath?: string;
	includeInterfaces?: boolean;
	includeImplementations?: boolean;
	maxDepth?: number;
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
		className: {
			type: z.string().optional(),
			description:
				'Name of class to analyze (e.g., "UserService"). Required if filePath not provided.',
		},
		filePath: {
			type: z.string().optional(),
			description:
				'Path to file containing class (e.g., "src/models/User.ts"). Required if className not provided.',
		},
		includeInterfaces: {
			type: z.boolean().optional().default(true),
			description: 'Include interface implementations (default: true)',
		},
		includeImplementations: {
			type: z.boolean().optional().default(true),
			description:
				'Include all implementations of interfaces (default: true)',
		},
		maxDepth: {
			type: z.number().min(1).max(10).optional().default(10),
			description:
				'Maximum depth to traverse in hierarchy (default: 10)',
		},
	};

	/**
	 * Format the inheritance hierarchy for AI-friendly output
	 */
	protected formatResult(
		data: GetInheritanceHierarchyResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { root, hierarchy, relations, analysis, diagram } = data;

		let output = `Inheritance Hierarchy: ${root.name}\n\n`;

		// Root class info
		output += `## Root Class\n`;
		output += `Name: ${root.qualifiedName}\n`;
		output += `File: ${root.filePath}:${root.line}\n`;
		output += `Type: ${root.kind}\n`;
		output += `Visibility: ${root.visibility}\n`;
		if (root.isAbstract) {
			output += `Abstract: Yes\n`;
		}
		output += `Members: ${root.members.methods} methods, ${root.members.properties} properties\n`;
		if (root.members.abstractMethods > 0) {
			output += `Abstract Methods: ${root.members.abstractMethods}\n`;
		}

		// Analysis
		output += `\n## Hierarchy Analysis\n`;
		output += `Depth: ${analysis.depth} levels\n`;
		output += `Breadth: ${analysis.breadth} classes at widest level\n`;
		output += `Total Classes: ${analysis.totalClasses}\n`;
		output += `Complexity: ${this.getComplexityEmoji(analysis.complexity)} ${analysis.complexity}\n`;

		// Issues
		if (analysis.issues.length > 0) {
			output += `\n### ⚠️  Issues (${analysis.issues.length})\n`;
			for (const issue of analysis.issues) {
				output += `  • ${issue}\n`;
			}
		}

		// Hierarchy visualization
		output += `\n## Hierarchy Diagram\n`;
		output += '```\n';
		output += diagram;
		output += '\n```\n';

		// Ancestors (parent classes)
		if (hierarchy.ancestors.length > 0) {
			output += `\n## Ancestors (${hierarchy.ancestors.length})\n`;
			output += `Classes that ${root.name} extends:\n\n`;
			for (const ancestor of hierarchy.ancestors) {
				output += `  ${this.getKindIcon(ancestor.kind)} ${ancestor.qualifiedName}\n`;
				output += `     ${ancestor.filePath}:${ancestor.line}\n`;
				if (ancestor.isAbstract) {
					output += `     Abstract class\n`;
				}
			}
			output += '\n';
		}

		// Interfaces
		if (hierarchy.interfaces.length > 0) {
			output += `## Interfaces (${hierarchy.interfaces.length})\n`;
			output += `Interfaces that ${root.name} implements:\n\n`;
			for (const iface of hierarchy.interfaces) {
				output += `  📋 ${iface.qualifiedName}\n`;
				output += `     ${iface.filePath}:${iface.line}\n`;
			}
			output += '\n';
		}

		// Descendants (child classes)
		if (hierarchy.descendants.length > 0) {
			output += `## Descendants (${hierarchy.descendants.length})\n`;
			output += `Classes that extend ${root.name}:\n\n`;

			// Group by depth
			const byDepth = new Map<number, ClassNode[]>();
			for (const desc of hierarchy.descendants) {
				// In real implementation, would track depth
				const depth = 1; // Placeholder
				if (!byDepth.has(depth)) {
					byDepth.set(depth, []);
				}
				byDepth.get(depth)!.push(desc);
			}

			for (const [depth, classes] of Array.from(byDepth.entries()).sort(([a], [b]) => a - b)) {
				output += `  Level ${depth}:\n`;
				for (const cls of classes.slice(0, 10)) {
					output += `    ${this.getKindIcon(cls.kind)} ${cls.qualifiedName}\n`;
					output += `       ${cls.filePath}:${cls.line}\n`;
				}
				if (classes.length > 10) {
					output += `    ... and ${classes.length - 10} more\n`;
				}
			}
			output += '\n';
		}

		// Siblings
		if (hierarchy.siblings.length > 0) {
			output += `## Siblings (${hierarchy.siblings.length})\n`;
			output += `Classes that share the same parent:\n\n`;
			for (const sibling of hierarchy.siblings.slice(0, 10)) {
				output += `  ${this.getKindIcon(sibling.kind)} ${sibling.qualifiedName}\n`;
				output += `     ${sibling.filePath}:${sibling.line}\n`;
			}
			if (hierarchy.siblings.length > 10) {
				output += `  ... and ${hierarchy.siblings.length - 10} more\n`;
			}
			output += '\n';
		}

		// Implementations
		if (hierarchy.implementations.length > 0) {
			output += `## All Implementations (${hierarchy.implementations.length})\n`;
			output += `If ${root.name} is an interface, these classes implement it:\n\n`;
			for (const impl of hierarchy.implementations.slice(0, 10)) {
				output += `  ${this.getKindIcon(impl.kind)} ${impl.qualifiedName}\n`;
				output += `     ${impl.filePath}:${impl.line}\n`;
			}
			if (hierarchy.implementations.length > 10) {
				output += `  ... and ${hierarchy.implementations.length - 10} more\n`;
			}
			output += '\n';
		}

		// Recommendations
		if (analysis.recommendations.length > 0) {
			output += `## 💡 Recommendations\n\n`;
			for (let i = 0; i < analysis.recommendations.length; i++) {
				output += `${i + 1}. ${analysis.recommendations[i]}\n`;
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
