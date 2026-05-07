import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { McpSession } from './mcp.types';

@Injectable()
export class McpTicketService {
  private readonly logger = new Logger(McpTicketService.name);
  private readonly TICKET_TTL_MS = 30_000; // 30 seconds
  private readonly SESSION_TTL_MS = 30 * 60_000; // 30 minutes

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async generateTicket(userId: string): Promise<string> {
    const ticket = crypto.randomBytes(32).toString('hex');
    const ticketKey = `mcp:ticket:${ticket}`;
    await this.cacheManager.set(ticketKey, userId, this.TICKET_TTL_MS);
    return ticket;
  }

  async validateTicket(ticket: string): Promise<McpSession> {
    const ticketKey = `mcp:ticket:${ticket}`;
    const userId = await this.cacheManager.get<string>(ticketKey);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired ticket');
    }
    await this.cacheManager.del(ticketKey);

    const session: McpSession = {
      userId,
      ticketId: crypto
        .createHash('sha256')
        .update(ticket)
        .digest('hex')
        .substring(0, 16),
      createdAt: new Date(),
    };

    const sessionKey = `mcp:session:${session.ticketId}`;
    await this.cacheManager.set(
      sessionKey,
      JSON.stringify(session),
      this.SESSION_TTL_MS,
    );

    return session;
  }

  async getSession(sessionId: string): Promise<McpSession | null> {
    const sessionKey = `mcp:session:${sessionId}`;
    const raw = await this.cacheManager.get<string>(sessionKey);
    if (!raw) return null;
    return JSON.parse(raw) as McpSession;
  }
}
