import { describe, expect, it } from 'vitest';
import {
  API_KEY_PLACEHOLDER,
  buildConnectConfigs,
  mcpServerName,
  shellQuote,
  SITE_TOKEN_PLACEHOLDER,
} from './connectConfigs';

const base = {
  apiHost: 'api.example.com',
  apiBaseUrl: 'https://api.raidr.app/',
};

describe('connectConfigs', () => {
  it('derives a safe server name', () => {
    expect(mcpServerName('api.example.com')).toBe('raidr-api-example-com');
    expect(mcpServerName('localhost:8123')).toBe('raidr-localhost-8123');
  });

  it('sends the raidr key as a bearer and the site token separately', () => {
    const c = buildConnectConfigs({
      ...base,
      apiKey: 'raidr_abc',
      siteToken: 'site123',
    });
    expect(c.url).toBe('https://api.raidr.app/mcp/api.example.com');
    expect(c.headers).toEqual({
      Authorization: 'Bearer raidr_abc',
      'X-Raidr-Token': 'site123',
    });
    expect(c.claudeCode.cli).toBe(
      "claude mcp add --transport http raidr-api-example-com https://api.raidr.app/mcp/api.example.com --header 'Authorization: Bearer raidr_abc' --header 'X-Raidr-Token: site123'"
    );
    expect(
      JSON.parse(c.claudeCode.json).mcpServers['raidr-api-example-com'].headers
    ).toEqual(c.headers);
    expect(
      JSON.parse(c.cursor.json).mcpServers['raidr-api-example-com'].headers
    ).toEqual(c.headers);
  });

  it('keeps spaces out of Claude Desktop args (Windows splits them) by using env vars', () => {
    const c = buildConnectConfigs({
      ...base,
      apiKey: 'raidr_abc',
      siteToken: 'site123',
    });
    const server = JSON.parse(c.claudeDesktop.json).mcpServers[
      'raidr-api-example-com'
    ];
    expect(server.args).toContain('mcp-remote');
    for (const arg of server.args) expect(arg).not.toMatch(/\s/);
    expect(server.env).toEqual({
      RAIDR_AUTH: 'Bearer raidr_abc',
      RAIDR_SITE_TOKEN: 'site123',
    });
  });

  it('uses space-free placeholders and drops the site token when the API needs none', () => {
    const c = buildConnectConfigs(base);
    expect(c.headers.Authorization).toBe(`Bearer ${API_KEY_PLACEHOLDER}`);
    expect(c.headers['X-Raidr-Token']).toBe(SITE_TOKEN_PLACEHOLDER);
    const open = buildConnectConfigs({ ...base, needsSiteToken: false });
    expect(open.headers).toEqual({
      Authorization: `Bearer ${API_KEY_PLACEHOLDER}`,
    });
    expect(open.claudeCode.cli).not.toContain('X-Raidr-Token');
  });

  it('shell-quotes tokens with special characters', () => {
    expect(shellQuote("a$b`c'd")).toBe(`'a$b\`c'\\''d'`);
    const c = buildConnectConfigs({
      ...base,
      apiKey: 'raidr_x',
      siteToken: 'sid=$HOME',
    });
    expect(c.claudeCode.cli).toContain("'X-Raidr-Token: sid=$HOME'");
  });
});
