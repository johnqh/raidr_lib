/**
 * The playground form for an endpoint of either doc version. Version 1
 * endpoints already list form parameters. A version-2 endpoint's input
 * schema is turned into the same `ApiParam` fields: one per path, query and
 * header property, and one per top-level body property when the body is a
 * JSON object (nested objects and arrays are JSON text fields). Any other
 * body (an array, a string) is one raw JSON editor. Pure.
 */
import {
  type AnyApiEndpoint,
  type ApiJsonSchema,
  type ApiParam,
  type ApiParamFormat,
  type ApiParamLocation,
  isApiEndpointV2,
} from '@sudobility/raidr_types';

/**
 * How the raw JSON editor is used:
 * - `none`: no editor.
 * - `extra`: extra body fields merged into the form's body fields (an object).
 * - `whole`: the entire body, any JSON value.
 */
export type RawBodyMode = 'none' | 'extra' | 'whole';

export interface PlaygroundForm {
  /** Form fields, path first, then query, headers and body. */
  params: ApiParam[];
  rawBody: RawBodyMode;
}

const FORMATS = new Set(['uuid', 'email', 'uri', 'date', 'date-time']);

/** The first non-null JSON type a schema declares. */
function mainType(schema: ApiJsonSchema): string | undefined {
  const types = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  return types.find(t => t !== 'null');
}

/** Where a header's value comes from, in words, appended to its description. */
function headerHint(schema: ApiJsonSchema): string {
  const source = schema['x-raidr-header'];
  switch (source?.kind) {
    case 'constant':
      return source.value !== undefined
        ? ` The site always sends "${source.value}".`
        : '';
    case 'cookie':
      return ` The site copies it from the "${source.key ?? ''}" cookie.`;
    case 'storage':
      return ` The site copies it from "${source.key ?? ''}" in browser storage.`;
    case 'response':
      return source.from
        ? ` Taken from "${source.from.field}" of ${source.from.endpointId}.`
        : '';
    case 'computed':
      return source.recipe
        ? ` Computed by the site: ${source.recipe.summary}.`
        : '';
    default:
      return '';
  }
}

/** One schema property as a form field. */
export function schemaToParam(
  name: string,
  location: ApiParamLocation,
  schema: ApiJsonSchema,
  required: boolean
): ApiParam {
  const type = mainType(schema);
  const description =
    `${schema.description ?? ''}${location === 'header' ? headerHint(schema) : ''}`.trim();
  const example =
    schema.examples?.[0] ??
    (location === 'header' && schema['x-raidr-header']?.kind === 'constant'
      ? schema['x-raidr-header'].value
      : undefined);
  const base: ApiParam = {
    name,
    in: location,
    type: 'string',
    required,
    ...(description ? { description } : {}),
    ...(example !== undefined ? { example } : {}),
  };
  const strings = (schema.enum ?? []).filter(
    (v): v is string => typeof v === 'string'
  );
  if (strings.length > 0 && strings.length === schema.enum?.length) {
    return { ...base, type: 'enum', enum: strings, enumExhaustive: true };
  }
  switch (type) {
    case 'integer':
    case 'number':
      return {
        ...base,
        type,
        ...(schema.minimum !== undefined ? { minimum: schema.minimum } : {}),
        ...(schema.maximum !== undefined ? { maximum: schema.maximum } : {}),
      };
    case 'boolean':
      return { ...base, type: 'boolean' };
    case 'object':
      return { ...base, type: 'object' };
    case 'array': {
      const item = schema.items ? mainType(schema.items) : undefined;
      const itemType =
        item === 'integer' ||
        item === 'number' ||
        item === 'boolean' ||
        item === 'object'
          ? item
          : 'string';
      return { ...base, type: 'array', itemType };
    }
    default:
      return {
        ...base,
        ...(schema.format && FORMATS.has(schema.format)
          ? { format: schema.format as ApiParamFormat }
          : {}),
        ...(schema.pattern ? { pattern: schema.pattern } : {}),
        ...(schema.minLength !== undefined
          ? { minLength: schema.minLength }
          : {}),
        ...(schema.maxLength !== undefined
          ? { maxLength: schema.maxLength }
          : {}),
      };
  }
}

function group(
  schema: ApiJsonSchema | undefined,
  location: ApiParamLocation,
  taken: Set<string>
): ApiParam[] {
  const required = new Set(schema?.required ?? []);
  return Object.entries(schema?.properties ?? {}).flatMap(
    ([name, property]) => {
      // Auth headers are the credential fields' job; a field name appears once.
      if (location === 'header' && property['x-raidr-header']?.kind === 'auth')
        return [];
      if (taken.has(name)) return [];
      taken.add(name);
      return [
        schemaToParam(
          name,
          location,
          property,
          location === 'path' || required.has(name)
        ),
      ];
    }
  );
}

/** The form for an endpoint of either version. */
export function formOf(endpoint: AnyApiEndpoint): PlaygroundForm {
  if (!isApiEndpointV2(endpoint)) {
    return {
      params: endpoint.params,
      rawBody: endpoint.additionalBody ? 'extra' : 'none',
    };
  }
  const groups = endpoint.input.properties;
  const taken = new Set<string>();
  const params = [
    ...group(groups.path, 'path', taken),
    ...group(groups.query, 'query', taken),
    ...group(groups.headers, 'header', taken),
  ];
  const body = endpoint.method === 'GET' ? undefined : groups.body;
  if (!body) return { params, rawBody: 'none' };
  const keys = Object.keys(body.properties ?? {});
  const isObject =
    mainType(body) === 'object' || (!body.type && keys.length > 0);
  if (!isObject || keys.length === 0 || keys.some(k => taken.has(k))) {
    return { params, rawBody: 'whole' };
  }
  return {
    params: [...params, ...group(body, 'body', taken)],
    rawBody: body.additionalProperties === false ? 'none' : 'extra',
  };
}
