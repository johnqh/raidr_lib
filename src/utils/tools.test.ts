import { describe, expect, it } from 'vitest';
import type { McpTool } from '@sudobility/raidr_types';
import {
  formatToolRequest,
  formatToolSignature,
  isMutatingTool,
  toolInputFields,
} from './tools';

const tool: McpTool = {
  name: 'create_note',
  description: 'Mutates: create a note',
  inputSchema: {
    type: 'object',
    properties: {
      folderId: { type: 'string', description: 'Folder' },
      expand: { type: 'boolean' },
      title: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      trace: { type: 'string' },
    },
    required: ['folderId', 'title'],
  },
  request: {
    method: 'POST',
    pathTemplate: '/folders/{folderId}/notes',
    query: { expand: 'expand' },
    body: 'json',
    bodyFields: ['title', 'tags'],
    headers: { trace: 'X-Trace' },
  },
};

describe('tools', () => {
  it('classifies each input by request location', () => {
    const fields = toolInputFields(tool);
    expect(fields.map(f => [f.name, f.location, f.required, f.type])).toEqual([
      ['folderId', 'path', true, 'string'],
      ['expand', 'query', false, 'boolean'],
      ['title', 'body', true, 'string'],
      ['tags', 'body', false, 'string[]'],
      ['trace', 'header', false, 'string'],
    ]);
    expect(fields[0]!.description).toBe('Folder');
  });

  it('formats signatures and requests', () => {
    expect(formatToolSignature(tool)).toBe(
      'create_note(folderId: string, expand?: boolean, title: string, tags?: string[], trace?: string)'
    );
    expect(formatToolRequest(tool)).toBe('POST /folders/{folderId}/notes');
  });

  it('detects mutations by method or description', () => {
    expect(isMutatingTool(tool)).toBe(true);
    expect(
      isMutatingTool({
        ...tool,
        request: { ...tool.request, method: 'GET' },
        description: 'List',
      })
    ).toBe(false);
  });
});
