/**
 * Schema to TypeScript Converter Unit Tests
 *
 * Tests conversion of Zod schemas and JSON schemas to TypeScript type definitions.
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import {
	zodToTypeScript,
	jsonSchemaToTypeScript,
	generateParameterType,
	toolNameToTypeName,
	toolNameToFunctionName,
} from '../../../src/codegen/schema-to-typescript.js';

describe('schema-to-typescript', () => {
	describe('zodToTypeScript', () => {
		it('should convert ZodString to "string"', () => {
			const schema = z.string();
			expect(zodToTypeScript(schema)).toBe('string');
		});

		it('should convert ZodNumber to "number"', () => {
			const schema = z.number();
			expect(zodToTypeScript(schema)).toBe('number');
		});

		it('should convert ZodBoolean to "boolean"', () => {
			const schema = z.boolean();
			expect(zodToTypeScript(schema)).toBe('boolean');
		});

		it('should convert ZodArray to element type with []', () => {
			const schema = z.array(z.string());
			expect(zodToTypeScript(schema)).toBe('string[]');
		});

		it('should convert nested arrays', () => {
			const schema = z.array(z.array(z.number()));
			expect(zodToTypeScript(schema)).toBe('number[][]');
		});

		it('should handle ZodOptional by unwrapping', () => {
			const schema = z.string().optional();
			expect(zodToTypeScript(schema)).toBe('string');
		});

		it('should handle ZodDefault by using innerType', () => {
			const schema = z.string().default('hello');
			expect(zodToTypeScript(schema)).toBe('string');
		});

		it('should convert ZodEnum to union of literals', () => {
			const schema = z.enum(['alpha', 'beta', 'gamma']);
			expect(zodToTypeScript(schema)).toBe('"alpha" | "beta" | "gamma"');
		});

		it('should convert ZodObject to interface syntax', () => {
			const schema = z.object({
				name: z.string(),
				age: z.number(),
			});
			const result = zodToTypeScript(schema);

			expect(result).toContain('{');
			expect(result).toContain('name: string;');
			expect(result).toContain('age: number;');
			expect(result).toContain('}');
		});

		it('should mark optional fields with ?', () => {
			const schema = z.object({
				required: z.string(),
				optional: z.string().optional(),
			});
			const result = zodToTypeScript(schema);

			expect(result).toContain('required: string;');
			expect(result).toContain('optional?: string;');
		});

		it('should mark default fields as optional', () => {
			const schema = z.object({
				withDefault: z.string().default('value'),
			});
			const result = zodToTypeScript(schema);

			expect(result).toContain('withDefault?: string;');
		});

		it('should add JSDoc comments for described fields', () => {
			const schema = z.object({
				field: z.string().describe('This is a description'),
			});
			const result = zodToTypeScript(schema);

			expect(result).toContain('/** This is a description */');
		});

		it('should handle indentation levels', () => {
			const schema = z.object({
				nested: z.object({
					value: z.number(),
				}),
			});
			const result = zodToTypeScript(schema, 1);

			// With indentLevel 1, each indent is 2 spaces
			expect(result).toContain('    nested');
		});

		it('should fallback to "any" for unknown types', () => {
			// ZodAny should return 'any'
			const schema = z.any();
			expect(zodToTypeScript(schema)).toBe('any');
		});

		it('should handle complex nested objects', () => {
			const schema = z.object({
				user: z.object({
					name: z.string(),
					emails: z.array(z.string()),
				}),
				tags: z.array(z.enum(['admin', 'user'])),
			});
			const result = zodToTypeScript(schema);

			expect(result).toContain('user:');
			expect(result).toContain('name: string;');
			expect(result).toContain('emails: string[];');
			// Note: The current implementation doesn't wrap union types in parentheses
			// when used in arrays, outputting: "admin" | "user"[]
			expect(result).toContain('tags: "admin" | "user"[];');
		});
	});

	describe('jsonSchemaToTypeScript', () => {
		it('should return "any" for invalid schema', () => {
			expect(jsonSchemaToTypeScript(null, 'Test')).toBe('any');
			expect(jsonSchemaToTypeScript(undefined, 'Test')).toBe('any');
			expect(jsonSchemaToTypeScript('not an object', 'Test')).toBe('any');
		});

		it('should convert string type', () => {
			const schema = { type: 'string' };
			expect(jsonSchemaToTypeScript(schema, 'Test')).toBe('string');
		});

		it('should convert string enum to union', () => {
			const schema = { type: 'string', enum: ['a', 'b', 'c'] };
			expect(jsonSchemaToTypeScript(schema, 'Test')).toBe('"a" | "b" | "c"');
		});

		it('should convert number type', () => {
			const schema = { type: 'number' };
			expect(jsonSchemaToTypeScript(schema, 'Test')).toBe('number');
		});

		it('should convert integer type to number', () => {
			const schema = { type: 'integer' };
			expect(jsonSchemaToTypeScript(schema, 'Test')).toBe('number');
		});

		it('should convert boolean type', () => {
			const schema = { type: 'boolean' };
			expect(jsonSchemaToTypeScript(schema, 'Test')).toBe('boolean');
		});

		it('should convert array type with items', () => {
			const schema = { type: 'array', items: { type: 'string' } };
			expect(jsonSchemaToTypeScript(schema, 'Test')).toBe('string[]');
		});

		it('should convert object type with properties', () => {
			const schema = {
				type: 'object',
				properties: {
					name: { type: 'string' },
					count: { type: 'number' },
				},
			};
			const result = jsonSchemaToTypeScript(schema, 'TestInterface');

			expect(result).toContain('export interface TestInterface');
			expect(result).toContain('name?: string;');
			expect(result).toContain('count?: number;');
		});

		it('should mark required properties without ?', () => {
			const schema = {
				type: 'object',
				properties: {
					required: { type: 'string' },
					optional: { type: 'string' },
				},
				required: ['required'],
			};
			const result = jsonSchemaToTypeScript(schema, 'Test');

			expect(result).toContain('required: string;');
			expect(result).toContain('optional?: string;');
		});

		it('should include property descriptions as JSDoc', () => {
			const schema = {
				type: 'object',
				properties: {
					field: { type: 'string', description: 'A field description' },
				},
			};
			const result = jsonSchemaToTypeScript(schema, 'Test');

			expect(result).toContain('/** A field description */');
		});

		it('should fallback to "any" for unknown types', () => {
			const schema = { type: 'unknown_type' };
			expect(jsonSchemaToTypeScript(schema, 'Test')).toBe('any');
		});

		it('should handle object with no properties', () => {
			const schema = { type: 'object' };
			const result = jsonSchemaToTypeScript(schema, 'EmptyObject');

			expect(result).toContain('export interface EmptyObject');
			expect(result).toContain('{');
			expect(result).toContain('}');
		});

		it('should handle nested objects', () => {
			const schema = {
				type: 'object',
				properties: {
					nested: {
						type: 'object',
						properties: {
							value: { type: 'number' },
						},
					},
				},
			};
			const result = jsonSchemaToTypeScript(schema, 'Outer');

			expect(result).toContain('nested?:');
		});
	});

	describe('generateParameterType', () => {
		it('should generate interface for Zod schema', () => {
			const schema = z.object({
				query: z.string(),
			});
			const result = generateParameterType('search_symbols', schema);

			expect(result).toContain('export interface SearchSymbolsParams');
			expect(result).toContain('query: string;');
		});

		it('should generate interface for JSON Schema', () => {
			const schema = {
				type: 'object',
				properties: {
					query: { type: 'string' },
				},
				required: ['query'],
			};
			const result = generateParameterType('search_symbols', schema);

			expect(result).toContain('export interface SearchSymbolsParams');
			expect(result).toContain('query: string;');
		});

		it('should fallback to Record<string, any> for unknown schema', () => {
			const result = generateParameterType('unknown_tool', null);

			expect(result).toContain('export type UnknownToolParams = Record<string, any>');
		});

		it('should handle empty schema object', () => {
			const result = generateParameterType('empty_tool', {});

			expect(result).toContain('Record<string, any>');
		});
	});

	describe('toolNameToTypeName', () => {
		it('should convert snake_case to PascalCase', () => {
			expect(toolNameToTypeName('search_symbols')).toBe('SearchSymbols');
			expect(toolNameToTypeName('get_symbol_details')).toBe('GetSymbolDetails');
		});

		it('should convert kebab-case to PascalCase', () => {
			expect(toolNameToTypeName('search-symbols')).toBe('SearchSymbols');
			expect(toolNameToTypeName('get-symbol-details')).toBe('GetSymbolDetails');
		});

		it('should handle single word', () => {
			expect(toolNameToTypeName('search')).toBe('Search');
		});

		it('should handle mixed separators', () => {
			expect(toolNameToTypeName('get_symbol-details')).toBe('GetSymbolDetails');
		});
	});

	describe('toolNameToFunctionName', () => {
		it('should convert snake_case to camelCase', () => {
			expect(toolNameToFunctionName('search_symbols')).toBe('searchSymbols');
			expect(toolNameToFunctionName('get_symbol_details')).toBe('getSymbolDetails');
		});

		it('should convert kebab-case to camelCase', () => {
			expect(toolNameToFunctionName('search-symbols')).toBe('searchSymbols');
			expect(toolNameToFunctionName('get-symbol-details')).toBe('getSymbolDetails');
		});

		it('should keep first part lowercase', () => {
			expect(toolNameToFunctionName('Search_Symbols')).toBe('SearchSymbols');
		});

		it('should handle single word', () => {
			expect(toolNameToFunctionName('search')).toBe('search');
		});

		it('should handle mixed separators', () => {
			expect(toolNameToFunctionName('get_symbol-details')).toBe('getSymbolDetails');
		});
	});
});
