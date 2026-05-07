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
  async generateTicket(@Req() req: Request) {
    const user = (req as any).user;
    const ticket = await this.ticketService.generateTicket(user.id);
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

    res.write(
      `data: ${JSON.stringify({ type: 'initialized', protocolVersion: '0.1.0', serverInfo: { name: 'mixology-hub', version: '1.0.0' } })}\n\n`,
    );

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
      const msg = req.body;
      const tools = this.mcpServer.getTools();

      switch (msg.method) {
        case 'tools/list':
          sseRes.write(`data: ${JSON.stringify({ type: 'tools', tools })}\n\n`);
          break;

        case 'tools/call':
          const toolCall: McpToolCall = msg.params;
          const result = await this.mcpServer.executeTool(toolCall, session);
          sseRes.write(
            `data: ${JSON.stringify({ type: 'tool_result', id: msg.id, result })}\n\n`,
          );
          break;

        default:
          sseRes.write(
            `data: ${JSON.stringify({ type: 'error', message: `Unknown method: ${msg.method}` })}\n\n`,
          );
      }

      res.json({ ok: true });
    } catch (err: any) {
      sseRes.write(
        `data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`,
      );
      res.status(500).json({ error: err.message });
    }
  }
}
