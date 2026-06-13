import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { McpServerService } from './mcp-server.service';
import { McpTicketService } from './mcp-ticket.service';
import { McpToolCall, McpSession } from './mcp.types';

interface JsonRpcMessage {
  jsonrpc: string;
  id: string | null;
  method?: string;
  params?: McpToolCall;
}

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('MCP')
@ApiBearerAuth()
@Controller('api/mcp')
export class McpController {
  private sseConnections = new Map<string, Response>();

  constructor(
    private readonly mcpServer: McpServerService,
    private readonly ticketService: McpTicketService,
  ) {}

  @Post('ticket')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate a one-time MCP ticket (30s TTL)' })
  async generateTicket(@Req() req: AuthenticatedRequest) {
    const ticket = await this.ticketService.generateTicket(req.user.id);
    return { ticket, expiresIn: 30 };
  }

  @Get('sse')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'MCP SSE transport endpoint' })
  async sse(@Req() req: Request, @Res() res: Response) {
    const ticket = (req.query.ticket as string) || '';
    let session: McpSession;

    try {
      session = await this.ticketService.validateTicket(ticket);
    } catch {
      res.status(401).json({ error: 'Invalid or expired ticket' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    this.sseConnections.set(session.ticketId, res);

    // Mandated MCP Handshake: Broadcast the HTTP POST endpoint URI using "event: endpoint"
    const messageEndpoint = `/api/mcp/messages?sessionId=${session.ticketId}`;
    res.write(`event: endpoint\ndata: ${messageEndpoint}\n\n`);

    req.on('close', () => {
      this.sseConnections.delete(session.ticketId);
      res.end();
    });
  }

  @Post('messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'MCP JSON-RPC message endpoint' })
  async messages(@Req() req: Request, @Res() res: Response) {
    const sessionId = (req.query.sessionId as string) || '';
    const sseRes = this.sseConnections.get(sessionId);

    if (!sseRes) {
      res
        .status(404)
        .json({ error: 'No active SSE connection for this session' });
      return;
    }

    const session = await this.ticketService.getSession(sessionId);
    if (!session) {
      res.status(401).json({ error: 'Session not found or expired' });
      return;
    }

    try {
      const msg = req.body as JsonRpcMessage;
      const tools = this.mcpServer.getTools();

      switch (msg.method) {
        case 'tools/list': {
          const jsonRpcResponse = {
            jsonrpc: '2.0',
            id: msg.id,
            result: { tools },
          };
          sseRes.write(
            `event: message\ndata: ${JSON.stringify(jsonRpcResponse)}\n\n`,
          );
          break;
        }

        case 'tools/call': {
          const toolCall: McpToolCall = msg.params as McpToolCall;
          const result = await this.mcpServer.executeTool(toolCall, session);
          const jsonRpcResponse = {
            jsonrpc: '2.0',
            id: msg.id,
            result,
          };
          sseRes.write(
            `event: message\ndata: ${JSON.stringify(jsonRpcResponse)}\n\n`,
          );
          break;
        }

        default: {
          const jsonRpcResponse = {
            jsonrpc: '2.0',
            id: msg.id,
            error: {
              code: -32601,
              message: `Method not found: ${msg.method ?? 'undefined'}`,
            },
          };
          sseRes.write(
            `event: message\ndata: ${JSON.stringify(jsonRpcResponse)}\n\n`,
          );
        }
      }

      res.status(200).json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const jsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message,
        },
      };
      sseRes.write(
        `event: message\ndata: ${JSON.stringify(jsonRpcResponse)}\n\n`,
      );
      res.status(500).json({ error: message });
    }
  }
}
