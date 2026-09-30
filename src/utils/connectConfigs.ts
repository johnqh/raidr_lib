/**
 * Connection snippets for the hosted MCP endpoint, one per client.
 *
 * The user's site token travels in the `X-Raidr-Token` header
 * (`RAIDR_TOKEN_HEADER`) and raidr_api forwards it upstream. These functions
 * only format strings; nothing here sends the token anywhere.
 */
import { mcpProxyUrl, RAIDR_TOKEN_HEADER } from '@sudobility/raidr_types';

/** Inputs for `buildConnectConfigs`. */
export interface ConnectConfigsInput {
  apiHost: string;
  /** raidr_api base, e.g. https://api.raidr.app */
  apiBaseUrl: string;
  /** Name the MCP client shows for this server; defaults to mcpServerName(apiHost). */
  serverName?: string;
  /** The user's site token; a placeholder is used when absent. */
  token?: string;
}

/** Copy-ready snippets; every `json` is pretty-printed with 2 spaces. */
export interface ConnectConfigs {
  /** `<apiBaseUrl>/mcp/<encoded apiHost>`. */
  url: string;
  headerName: string;
  /** `claude mcp add --transport http` command and `.mcp.json` body. */
  claudeCode: { cli: string; json: string };
  /** Claude Desktop config; bridges HTTP through `npx -y mcp-remote`. */
  claudeDesktop: { json: string };
  cursor: { json: string };
}

/** Shown in snippets until the user types a token. */
export const TOKEN_PLACEHOLDER = '<your token>';

/** `api.example.com` → `raidr-api-example-com` */
export function mcpServerName(apiHost: string): string {
  return `raidr-${apiHost
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

/** All client snippets for one API host; no token means the placeholder. */
export function buildConnectConfigs(
  input: ConnectConfigsInput
): ConnectConfigs {
  const url = mcpProxyUrl(input.apiBaseUrl, input.apiHost);
  const name = input.serverName ?? mcpServerName(input.apiHost);
  const token =
    input.token && input.token.length > 0 ? input.token : TOKEN_PLACEHOLDER;
  const header = `${RAIDR_TOKEN_HEADER}: ${token}`;

  const claudeCodeJson = {
    mcpServers: {
      [name]: { type: 'http', url, headers: { [RAIDR_TOKEN_HEADER]: token } },
    },
  };
  const claudeDesktopJson = {
    mcpServers: {
      [name]: {
        command: 'npx',
        args: ['-y', 'mcp-remote', url, '--header', header],
      },
    },
  };
  const cursorJson = {
    mcpServers: {
      [name]: { url, headers: { [RAIDR_TOKEN_HEADER]: token } },
    },
  };

  return {
    url,
    headerName: RAIDR_TOKEN_HEADER,
    claudeCode: {
      cli: `claude mcp add --transport http ${name} ${url} --header "${header}"`,
      json: JSON.stringify(claudeCodeJson, null, 2),
    },
    claudeDesktop: { json: JSON.stringify(claudeDesktopJson, null, 2) },
    cursor: { json: JSON.stringify(cursorJson, null, 2) },
  };
}
