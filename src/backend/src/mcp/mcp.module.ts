import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { McpController } from './mcp.controller';
import { McpServerService } from './mcp-server.service';
import { McpTicketService } from './mcp-ticket.service';
import { AiToolAudit } from '../ai/entities/ai-tool-audit.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { CocktailsModule } from '../cocktails/cocktails.module';
import { UtilsModule } from '../utils/utils.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiToolAudit]),
    ConfigModule,
    InventoryModule,
    CocktailsModule,
    UtilsModule,
    IngredientsModule,
    BullModule.registerQueue({ name: 'bar-orders' }),
  ],
  controllers: [McpController],
  providers: [McpServerService, McpTicketService],
  exports: [McpServerService],
})
export class McpModule {}
