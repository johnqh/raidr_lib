import { describe, expect, it } from 'vitest';
import {
  buildConnectConfigs,
  mcpServerName,
  TOKEN_PLACEHOLDER,
} from './connectConfigs';

describe('connectConfigs', () => {
  it('derives a safe server name', () => {
    expect(mcpServerName('api.example.com')).toBe('raidr-api-example-com');
    expect(mcpServerName('localhost:8123')).toBe('raidr-localhost-8123');
  });

  it('builds every client snippet around the proxy url and header', () => {
    const c = buildConnectConfigs({
      apiHost: 'api.example.com',
      apiBaseUrl: 'https://api.raidr.app/',
    });
    expect(c.url).toBe('https://api.raidr.app/mcp/api.example.com');
    expect(c.claudeCode.cli).toContain(
      '--transport http raidr-api-example-com https://api.raidr.app/mcp/api.example.com'
    );
    expect(c.claudeCode.cli).toContain(`X-Raidr-Token: ${TOKEN_PLACEHOLDER}`);
    expect(
      JSON.parse(c.claudeCode.json).mcpServers['raidr-api-example-com'].headers[
        'X-Raidr-Token'
      ]
    ).toBe(TOKEN_PLACEHOLDER);
    expect(
      JSON.parse(c.claudeDesktop.json).mcpServers['raidr-api-example-com'].args
    ).toContain('mcp-remote');
    expect(
      JSON.parse(c.cursor.json).mcpServers['raidr-api-example-com'].url
    ).toBe(c.url);
  });

  it('inlines a real token when given', () => {
    const c = buildConnectConfigs({
      apiHost: 'api.example.com',
      apiBaseUrl: 'https://api.raidr.app',
      token: 'abc',
    });
    expect(c.claudeCode.cli).toContain('X-Raidr-Token: abc');
    expect(c.claudeCode.cli).not.toContain(TOKEN_PLACEHOLDER);
  });
});
