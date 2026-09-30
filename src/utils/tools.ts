/**
 * Presentation helpers for manifest tools, used by the app's tools table and
 * by `useMcp` to split read and write tools.
 */
import type { JsonSchema, McpTool } from '@sudobility/raidr_types';

/** One input of a tool, flattened from its JSON Schema for display. */
export interface ToolInputField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  /** Where the field goes in the upstream request. */
  location: 'path' | 'query' | 'header' | 'body';
}

/** Type label: `string`, `a | b`, `string[]`, an enum's values, or `any`. */
function schemaType(schema: JsonSchema | undefined): string {
  if (!schema) return 'any';
  const type = schema['type'];
  if (Array.isArray(type)) return type.join(' | ');
  if (typeof type === 'string') {
    if (type === 'array') {
      const items = schema['items'] as JsonSchema | undefined;
      return `${schemaType(items)}[]`;
    }
    return type;
  }
  if (Array.isArray(schema['enum']))
    return (schema['enum'] as unknown[]).map(String).join(' | ');
  return 'any';
}

/**
 * Inputs of a tool in schema property order. Location is inferred: a name in
 * the path template is `path`, then a key of `request.query` is `query`, then
 * a key of `request.headers` is `header`, otherwise `body`.
 */
export function toolInputFields(tool: McpTool): ToolInputField[] {
  const required = new Set(tool.inputSchema.required ?? []);
  const pathParams = new Set(
    Array.from(
      tool.request.pathTemplate.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)
    ).map(m => m[1])
  );
  const query = tool.request.query ?? {};
  const headers = tool.request.headers ?? {};
  return Object.entries(tool.inputSchema.properties ?? {}).map(
    ([name, schema]) => ({
      name,
      type: schemaType(schema),
      required: required.has(name),
      description:
        typeof schema['description'] === 'string' ? schema['description'] : '',
      location: pathParams.has(name)
        ? 'path'
        : name in query
          ? 'query'
          : name in headers
            ? 'header'
            : 'body',
    })
  );
}

/** `get_user(userId: string, expand?: boolean)` */
export function formatToolSignature(tool: McpTool): string {
  const args = toolInputFields(tool)
    .map(f => `${f.name}${f.required ? '' : '?'}: ${f.type}`)
    .join(', ');
  return `${tool.name}(${args})`;
}

/** `GET /api/users/{userId}` */
export function formatToolRequest(tool: McpTool): string {
  return `${tool.request.method} ${tool.request.pathTemplate}`;
}

/**
 * True when calling the tool may change upstream state: any non-GET method,
 * or any tool whose description starts with `mutates:` (case-insensitive),
 * so a GET with side effects can be flagged in its description.
 */
export function isMutatingTool(tool: McpTool): boolean {
  return tool.request.method !== 'GET' || /^mutates:/i.test(tool.description);
}
