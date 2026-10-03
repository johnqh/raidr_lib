/**
 * The API playground's form model: what control each parameter gets, how its
 * text is validated, and how it is turned into a typed value for the request.
 * Pure; the app renders, this decides.
 *
 * Form values are always strings (what an input holds). Booleans are
 * `'true'`/`'false'`/`''`; arrays of scalars are comma-separated; objects and
 * arrays of objects are JSON text. An empty string means "not sent".
 */
import {
  type AnyApiEndpoint,
  type ApiEndpointV2,
  type ApiExecuteInput,
  type ApiExecuteRequest,
  type ApiParam,
  isApiEndpointV2,
} from '@sudobility/raidr_types';
import { formOf } from './schemaForm';

/**
 * Control for a parameter:
 * - `text`: free text, validated by format/pattern/length.
 * - `number`: integer or decimal.
 * - `select`: an enum; `allowOther` when the values are only those seen in use.
 * - `switch`: a boolean.
 * - `list`: comma-separated scalars.
 * - `json`: an object, or an array of objects.
 */
export type ParamControl =
  | {
      kind: 'text';
      inputType: 'text' | 'email' | 'url' | 'date' | 'datetime-local';
    }
  | { kind: 'number'; integer: boolean }
  | { kind: 'select'; options: string[]; allowOther: boolean }
  | { kind: 'switch' }
  | { kind: 'list' }
  | { kind: 'json' };

export function paramControl(param: ApiParam): ParamControl {
  switch (param.type) {
    case 'integer':
      return { kind: 'number', integer: true };
    case 'number':
      return { kind: 'number', integer: false };
    case 'boolean':
      return { kind: 'switch' };
    case 'enum':
      return {
        kind: 'select',
        options: param.enum ?? [],
        allowOther: param.enumExhaustive === false,
      };
    case 'object':
      return { kind: 'json' };
    case 'array':
      return param.itemType === 'object' ? { kind: 'json' } : { kind: 'list' };
    default:
      return {
        kind: 'text',
        inputType:
          param.format === 'email'
            ? 'email'
            : param.format === 'uri'
              ? 'url'
              : param.format === 'date'
                ? 'date'
                : param.format === 'date-time'
                  ? 'datetime-local'
                  : 'text',
      };
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function validateScalar(
  type: 'string' | 'integer' | 'number' | 'boolean',
  value: string,
  param: ApiParam
): string | null {
  if (type === 'integer') {
    if (!/^-?\d+$/.test(value)) return 'Enter a whole number';
  } else if (type === 'number') {
    if (value.trim() === '' || !Number.isFinite(Number(value)))
      return 'Enter a number';
  } else if (type === 'boolean') {
    if (value !== 'true' && value !== 'false') return 'Choose true or false';
    return null;
  }
  if (type === 'integer' || type === 'number') {
    const n = Number(value);
    if (param.minimum !== undefined && n < param.minimum)
      return `Must be at least ${param.minimum}`;
    if (param.maximum !== undefined && n > param.maximum)
      return `Must be at most ${param.maximum}`;
    return null;
  }
  switch (param.format) {
    case 'uuid':
      if (!UUID_RE.test(value)) return 'Enter a UUID (8-4-4-4-12 hex digits)';
      break;
    case 'email':
      if (!EMAIL_RE.test(value)) return 'Enter an email address';
      break;
    case 'uri':
      try {
        new URL(value);
      } catch {
        return 'Enter a full URL (https://…)';
      }
      break;
    case 'date':
      if (!DATE_RE.test(value)) return 'Enter a date (YYYY-MM-DD)';
      break;
    case 'date-time':
      if (!DATE_TIME_RE.test(value)) return 'Enter a date and time';
      break;
  }
  if (param.minLength !== undefined && value.length < param.minLength)
    return `At least ${param.minLength} characters`;
  if (param.maxLength !== undefined && value.length > param.maxLength)
    return `At most ${param.maxLength} characters`;
  if (param.pattern) {
    try {
      if (!new RegExp(param.pattern).test(value))
        return 'Does not match the expected format';
    } catch {
      // A bad pattern in the doc must not block the user.
    }
  }
  return null;
}

/** Error message for one value, or null when it is acceptable. Empty is "not sent". */
export function validateParam(param: ApiParam, raw: string): string | null {
  if (raw === '') return param.required ? 'Required' : null;
  switch (param.type) {
    case 'enum':
      if (
        param.enumExhaustive !== false &&
        param.enum &&
        !param.enum.includes(raw)
      ) {
        return `Choose one of: ${param.enum.join(', ')}`;
      }
      return null;
    case 'object': {
      try {
        const value = JSON.parse(raw) as unknown;
        return value && typeof value === 'object' && !Array.isArray(value)
          ? null
          : 'Enter a JSON object ({ … })';
      } catch {
        return 'Enter valid JSON';
      }
    }
    case 'array': {
      if (param.itemType === 'object') {
        try {
          return Array.isArray(JSON.parse(raw))
            ? null
            : 'Enter a JSON array ([ … ])';
        } catch {
          return 'Enter valid JSON';
        }
      }
      const items = raw
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '');
      for (const item of items) {
        const error = validateScalar(param.itemType ?? 'string', item, param);
        if (error) return `"${item}": ${error}`;
      }
      return null;
    }
    default:
      return validateScalar(param.type, raw, param);
  }
}

/** Typed value for the request; `undefined` means "do not send". Assumes `validateParam` passed. */
export function coerceParam(param: ApiParam, raw: string): unknown {
  if (raw === '') return undefined;
  const scalar = (type: string | undefined, value: string): unknown =>
    type === 'integer' || type === 'number'
      ? Number(value)
      : type === 'boolean'
        ? value === 'true'
        : value;
  switch (param.type) {
    case 'object':
      return JSON.parse(raw) as unknown;
    case 'array':
      return param.itemType === 'object'
        ? (JSON.parse(raw) as unknown)
        : raw
            .split(',')
            .map(s => s.trim())
            .filter(s => s !== '')
            .map(s => scalar(param.itemType, s));
    case 'enum':
      return raw;
    default:
      return scalar(param.type, raw);
  }
}

/** Placeholder text from the example or the format. */
export function paramPlaceholder(param: ApiParam): string {
  if (param.example !== undefined)
    return typeof param.example === 'string'
      ? param.example
      : JSON.stringify(param.example);
  if (param.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
  if (param.type === 'object') return '{ }';
  if (param.type === 'array')
    return param.itemType === 'object' ? '[ { } ]' : 'a, b, c';
  return '';
}

export interface BuiltExecute {
  /** Set when every value is valid. */
  request: ApiExecuteRequest | null;
  /** Errors by parameter name; `extraBody` for the raw JSON body. */
  errors: Record<string, string>;
}

/**
 * Validate the whole form and build the execute request. `extraBodyText` is
 * the raw JSON editor: extra body fields for a version-1 endpoint with
 * `additionalBody` (or a version-2 object body), the whole body for a
 * version-2 body that is not an object (see `formOf`).
 */
export function buildExecute(
  endpoint: AnyApiEndpoint,
  values: Record<string, string>,
  extraBodyText: string,
  credentials: { userToken?: string; apiKey?: string }
): BuiltExecute {
  if (isApiEndpointV2(endpoint))
    return buildExecuteV2(endpoint, values, extraBodyText, credentials);
  const errors: Record<string, string> = {};
  const params: Record<string, unknown> = {};
  for (const param of endpoint.params) {
    const raw = values[param.name] ?? '';
    const error = validateParam(param, raw);
    if (error) {
      errors[param.name] = error;
      continue;
    }
    const value = coerceParam(param, raw);
    if (value !== undefined) params[param.name] = value;
  }
  let extraBody: Record<string, unknown> | undefined;
  if (endpoint.additionalBody && extraBodyText.trim() !== '') {
    try {
      const parsed = JSON.parse(extraBodyText) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        extraBody = parsed as Record<string, unknown>;
      else errors.extraBody = 'Enter a JSON object ({ … })';
    } catch {
      errors.extraBody = 'Enter valid JSON';
    }
  }
  if (Object.keys(errors).length > 0) return { request: null, errors };
  return {
    request: {
      endpointId: endpoint.id,
      params,
      ...(extraBody ? { extraBody } : {}),
      ...(endpoint.auth === 'user' && credentials.userToken
        ? { userToken: credentials.userToken }
        : {}),
      ...(endpoint.auth === 'api_key' && credentials.apiKey
        ? { apiKey: credentials.apiKey }
        : {}),
    },
    errors,
  };
}

/** The credential a request carries, for the endpoint's auth. */
function credentialFields(
  auth: AnyApiEndpoint['auth'],
  credentials: { userToken?: string; apiKey?: string }
): Pick<ApiExecuteRequest, 'userToken' | 'apiKey'> {
  return {
    ...(auth === 'user' && credentials.userToken
      ? { userToken: credentials.userToken }
      : {}),
    ...(auth === 'api_key' && credentials.apiKey
      ? { apiKey: credentials.apiKey }
      : {}),
  };
}

/** `buildExecute` for a version-2 endpoint: values grouped as `input`. */
function buildExecuteV2(
  endpoint: ApiEndpointV2,
  values: Record<string, string>,
  rawBodyText: string,
  credentials: { userToken?: string; apiKey?: string }
): BuiltExecute {
  const form = formOf(endpoint);
  const errors: Record<string, string> = {};
  const input: ApiExecuteInput = {};
  const fields: Record<string, unknown> = {};
  for (const param of form.params) {
    const raw = values[param.name] ?? '';
    const error = validateParam(param, raw);
    if (error) {
      errors[param.name] = error;
      continue;
    }
    const value = coerceParam(param, raw);
    if (value === undefined) continue;
    if (param.in === 'path') (input.path ??= {})[param.name] = value;
    else if (param.in === 'query') (input.query ??= {})[param.name] = value;
    else if (param.in === 'header')
      (input.headers ??= {})[param.name] =
        typeof value === 'string' ? value : JSON.stringify(value);
    else fields[param.name] = value;
  }
  let body: unknown = Object.keys(fields).length > 0 ? fields : undefined;
  if (form.rawBody !== 'none' && rawBodyText.trim() !== '') {
    try {
      const parsed = JSON.parse(rawBodyText) as unknown;
      if (form.rawBody === 'whole') body = parsed;
      else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        body = { ...(parsed as Record<string, unknown>), ...fields };
      else errors.extraBody = 'Enter a JSON object ({ … })';
    } catch {
      errors.extraBody = 'Enter valid JSON';
    }
  }
  if (body !== undefined) input.body = body;
  if (Object.keys(errors).length > 0) return { request: null, errors };
  return {
    request: {
      endpointId: endpoint.id,
      params: {},
      input,
      ...credentialFields(endpoint.auth, credentials),
    },
    errors,
  };
}
