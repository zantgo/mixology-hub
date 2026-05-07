export interface McpToolDefinition {
  name: string;
  description: string;
  isWrite: boolean;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: 'text' | 'resource'; text?: string }>;
  isError?: boolean;
}

export interface McpSession {
  userId: string;
  ticketId: string;
  createdAt: Date;
}
