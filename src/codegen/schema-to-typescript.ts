/**
 * Schema to TypeScript Converter
 *
 * Converts Zod schemas from tool definitions to TypeScript interfaces
 * for Code Mode API generation.
 */

import { z } from 'zod';

/**
 * Convert a Zod schema to TypeScript type definition string
 */
export function zodToTypeScript(
  schema: z.ZodTypeAny,
  indentLevel: number = 0
): string {
  const indent = '  '.repeat(indentLevel);

  // Handle different Zod types
  if (schema instanceof z.ZodString) {
    return 'string';
  }

  if (schema instanceof z.ZodNumber) {
    return 'number';
  }

  if (schema instanceof z.ZodBoolean) {
    return 'boolean';
  }

  if (schema instanceof z.ZodArray) {
    const elementType = zodToTypeScript(schema.element, indentLevel);
    return `${elementType}[]`;
  }

  if (schema instanceof z.ZodOptional) {
    return zodToTypeScript(schema.unwrap(), indentLevel);
  }

  if (schema instanceof z.ZodDefault) {
    return zodToTypeScript(schema._def.innerType, indentLevel);
  }

  if (schema instanceof z.ZodEnum) {
    const values = schema.options as string[];
    return values.map(v => `"${v}"`).join(' | ');
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const lines: string[] = ['{'];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodTypeAny;
      const isOptional = fieldSchema instanceof z.ZodOptional ||
                         fieldSchema instanceof z.ZodDefault;
      const fieldType = zodToTypeScript(fieldSchema, indentLevel + 1);
      const optionalMarker = isOptional ? '?' : '';

      // Add JSDoc comment if description exists
      const description = getSchemaDescription(fieldSchema);
      if (description) {
        lines.push(`${indent}  /** ${description} */`);
      }

      lines.push(`${indent}  ${key}${optionalMarker}: ${fieldType};`);
    }

    lines.push(`${indent}}`);
    return lines.join('\n');
  }

  // Fallback for unhandled types
  return 'any';
}

/**
 * Extract description from Zod schema if available
 */
function getSchemaDescription(schema: z.ZodTypeAny): string | null {
  // Check for describe() method result
  const def = (schema as any)._def;
  if (def?.description) {
    return def.description;
  }

  // For optional/default schemas, check the inner type
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return getSchemaDescription(schema._def.innerType);
  }

  return null;
}

/**
 * Convert tool input schema from JSON Schema format to TypeScript
 */
export function jsonSchemaToTypeScript(
  schema: any,
  name: string,
  indentLevel: number = 0
): string {
  const indent = '  '.repeat(indentLevel);

  if (!schema || typeof schema !== 'object') {
    return 'any';
  }

  if (schema.type === 'string') {
    if (schema.enum) {
      return schema.enum.map((v: string) => `"${v}"`).join(' | ');
    }
    return 'string';
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return 'number';
  }

  if (schema.type === 'boolean') {
    return 'boolean';
  }

  if (schema.type === 'array') {
    const itemType = jsonSchemaToTypeScript(schema.items, '', indentLevel);
    return `${itemType}[]`;
  }

  if (schema.type === 'object') {
    const properties = schema.properties || {};
    const required = schema.required || [];
    const lines: string[] = [];

    lines.push(`export interface ${name} {`);

    for (const [key, propSchema] of Object.entries(properties)) {
      const isRequired = required.includes(key);
      const propType = jsonSchemaToTypeScript(propSchema, '', indentLevel + 1);
      const optionalMarker = isRequired ? '' : '?';

      // Add description if available
      const description = (propSchema as any).description;
      if (description) {
        lines.push(`${indent}  /** ${description} */`);
      }

      lines.push(`${indent}  ${key}${optionalMarker}: ${propType};`);
    }

    lines.push(`${indent}}`);
    return lines.join('\n');
  }

  return 'any';
}

/**
 * Generate TypeScript parameter type from tool schema
 */
export function generateParameterType(
  toolName: string,
  inputSchema: any
): string {
  const typeName = toolNameToTypeName(toolName) + 'Params';

  if (inputSchema && typeof inputSchema === 'object') {
    // Handle Zod schema
    if ('shape' in inputSchema || '_def' in inputSchema) {
      const typeDefinition = zodToTypeScript(inputSchema as z.ZodTypeAny);
      return `export interface ${typeName} ${typeDefinition}`;
    }

    // Handle JSON Schema
    if ('type' in inputSchema || 'properties' in inputSchema) {
      return jsonSchemaToTypeScript(inputSchema, typeName);
    }
  }

  return `export type ${typeName} = Record<string, any>`;
}

/**
 * Convert kebab-case tool name to PascalCase type name
 */
export function toolNameToTypeName(toolName: string): string {
  return toolName
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Convert kebab-case tool name to camelCase function name
 */
export function toolNameToFunctionName(toolName: string): string {
  const parts = toolName.split(/[-_]/);
  return parts[0] + parts.slice(1)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}