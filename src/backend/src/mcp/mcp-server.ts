/**
 * Standalone MCP server entrypoint for stdio transport.
 *
 * Usage: node dist/mcp/mcp-server.js
 *
 * This script reads JSON-RPC messages from stdin and writes responses to stdout,
 * enabling local LLM clients (Claude Desktop, Continue.dev) to use MixologyHub tools.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { McpServerService } from './mcp-server.service';
import { McpSession, McpToolCall } from './mcp.types';

interface JsonRpcMessage {
  jsonrpc: string;
  id: string | null;
  method?: string;
  params?: McpToolCall;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    forceCloseConnections: true,
  });
  const mcpServer = app.get(McpServerService);

  const session: McpSession = {
    userId: 'stdio-user',
    ticketId: 'stdio-session',
    createdAt: new Date(),
  };

  process.stdin.setEncoding('utf-8');
  let buffer = '';

  process.stdin.on('data', (chunk: string) => {
    void (async () => {
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const msg = JSON.parse(line) as JsonRpcMessage;

          switch (msg.method) {
            case 'initialize': {
              process.stdout.write(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  result: {
                    protocolVersion: '0.1.0',
                    serverInfo: { name: 'mixology-hub', version: '1.0.0' },
                    capabilities: { tools: {} },
                  },
                }) + '\n',
              );
              break;
            }

            case 'tools/list': {
              const tools = mcpServer.getTools();
              process.stdout.write(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  result: { tools },
                }) + '\n',
              );
              break;
            }

            case 'tools/call': {
              const toolCall: McpToolCall = msg.params as McpToolCall;
              const result = await mcpServer.executeTool(toolCall, session);
              process.stdout.write(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  result,
                }) + '\n',
              );
              break;
            }

            default:
              process.stdout.write(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  error: {
                    code: -32601,
                    message: `Unknown method: ${msg.method ?? 'undefined'}`,
                  },
                }) + '\n',
              );
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: null,
              error: { code: -32603, message },
            }) + '\n',
          );
        }
      }
    })();
  });

  process.stdin.on('end', () => {
    void app.close().then(() => process.exit(0));
  });
}

void bootstrap();
