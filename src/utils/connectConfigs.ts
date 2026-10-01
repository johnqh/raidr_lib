/**
 * @fileoverview Connection snippets for the hosted MCP endpoint, one per client.
 *
 * Every connection carries two credentials in two headers:
 * - `Authorization: Bearer raidr_...`: the user's raidr entity API key, which
 *   gets them into raidr's hosted MCP server at all;
 * - `X-Raidr-Token: ...`: their own token for the upstream site, which the
 *   server forwards to that site's API and never stores.
 * Values the user has not entered yet appear as space-free placeholders so
 * the snippets survive shells and Windows argument splitting.
 */
import { mcpProxyUrl, RAIDR_TOKEN_HEADER } from '@sudobility/raidr_types';

/** Inputs for `buildConnectConfigs`. */
export interface ConnectConfigsInput {
  apiHost: string;
  /** raidr_api base, e.g. https://api.raidr.app */
  apiBaseUrl: string;
  /** Name the MCP client shows for this server; defaults to mcpServerName(apiHost). */
  serverName?: string;
  /** The user's raidr entity API key (`raidr_...`); a placeholder when absent. */
  apiKey?: string;
  /** The user's token for the upstream site; a placeholder when absent. */
  siteToken?: string;
  /**
   * Whether the upstream API needs a site token (manifest auth style other
   * than "none"). When false the X-Raidr-Token header is left out entirely.
   */
  needsSiteToken?: boolean;
}

/** Copy-ready snippets; every `json` is pretty-printed with 2 spaces. */
export interface ConnectConfigs {
  /** The hosted endpoint, `${apiBaseUrl}/mcp/${apiHost}`. */
  url: string;
  /** The headers every client sends, in order. */
  headers: Record<string, string>;
  /** `claude mcp add ...` one-liner, and the equivalent `.mcp.json`. */
  claudeCode: { cli: string; json: string };
  /** `claude_desktop_config.json`, bridged through mcp-remote. */
  claudeDesktop: { json: string };
  /** `.cursor/mcp.json`. */
  cursor: { json: string };
}

/** Shown until the user pastes their raidr API key. */
export const API_KEY_PLACEHOLDER = 'raidr_YOUR_API_KEY';
/** Shown until the user types their site token. */
export const SITE_TOKEN_PLACEHOLDER = 'YOUR_SITE_TOKEN';

/** `api.example.com` → `raidr-api-example-com` */
export function mcpServerName(apiHost: string): string {
  return `raidr-${apiHost
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

/** Quote a value for a POSIX shell: single quotes, with embedded ones escaped. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** All client snippets for one API host; missing credentials become placeholders. */
export function buildConnectConfigs(
  input: ConnectConfigsInput
): ConnectConfigs {
  const url = mcpProxyUrl(input.apiBaseUrl, input.apiHost);
  const name = input.serverName ?? mcpServerName(input.apiHost);
  const apiKey = input.apiKey?.trim() || API_KEY_PLACEHOLDER;
  const siteToken = input.siteToken?.trim() || SITE_TOKEN_PLACEHOLDER;
  const needsSiteToken = input.needsSiteToken ?? true;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (needsSiteToken) headers[RAIDR_TOKEN_HEADER] = siteToken;

  const cliHeaders = Object.entries(headers)
    .map(([k, v]) => `--header ${shellQuote(`${k}: ${v}`)}`)
    .join(' ');

  // mcp-remote's README pattern: values in env, "Name:${VAR}" args with no
  // space, because Claude Desktop on Windows splits arguments on spaces.
  const desktopArgs = [
    '-y',
    'mcp-remote',
    url,
    '--header',
    'Authorization:${RAIDR_AUTH}',
  ];
  const desktopEnv: Record<string, string> = { RAIDR_AUTH: `Bearer ${apiKey}` };
  if (needsSiteToken) {
    desktopArgs.push('--header', `${RAIDR_TOKEN_HEADER}:\${RAIDR_SITE_TOKEN}`);
    desktopEnv.RAIDR_SITE_TOKEN = siteToken;
  }

  return {
    url,
    headers,
    claudeCode: {
      cli: `claude mcp add --transport http ${name} ${url} ${cliHeaders}`,
      json: JSON.stringify(
        { mcpServers: { [name]: { type: 'http', url, headers } } },
        null,
        2
      ),
    },
    claudeDesktop: {
      json: JSON.stringify(
        {
          mcpServers: {
            [name]: { command: 'npx', args: desktopArgs, env: desktopEnv },
          },
        },
        null,
        2
      ),
    },
    cursor: {
      json: JSON.stringify(
        { mcpServers: { [name]: { url, headers } } },
        null,
        2
      ),
    },
  };
}
