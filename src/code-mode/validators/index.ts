/**
 * Validators Module
 * AST-based code validation for sandbox security
 */

export {
	validateAst,
	offsetToLocation,
	type AstValidationResult,
	type AstValidationError,
	type LocationInfo,
} from './ast-validator.js';

export {
	DANGEROUS_PATTERNS,
	DANGEROUS_PROPERTIES,
	DANGEROUS_GLOBALS,
	checkAllPatterns,
	type PatternMatch,
	type PatternChecker,
} from './dangerous-patterns.js';

export {
	walk,
	getChildNodes,
	type WalkOptions,
	type NodeVisitor,
} from './ast-walker.js';
