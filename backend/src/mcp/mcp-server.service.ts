import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import { BarInventoryService } from '../inventory/bar-inventory.service';
import { CocktailAggregatorService } from '../cocktails/cocktail-aggregator.service';
import { CocktailsService } from '../cocktails/cocktails.service';
import { UnitConverterService } from '../utils/unit-converter.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AiToolAudit } from '../ai/entities/ai-tool-audit.entity';
import { ConfigService } from '@nestjs/config';
import {
  McpToolDefinition,
  McpToolCall,
  McpToolResult,
  McpSession,
} from './mcp.types';

@Injectable()
export class McpServerService {
  private readonly logger = new Logger(McpServerService.name);

  constructor(
    private readonly barInventoryService: BarInventoryService,
    private readonly aggregatorService: CocktailAggregatorService,
    private readonly cocktailsService: CocktailsService,
    private readonly unitConverter: UnitConverterService,
    @InjectQueue('bar-orders')
    private readonly barOrdersQueue: Queue,
    @InjectRepository(AiToolAudit)
    private readonly auditRepository: Repository<AiToolAudit>,
    private readonly configService: ConfigService,
  ) {}

  getTools(): McpToolDefinition[] {
    return [
      {
        name: 'get_bar_inventory',
        description: 'Retrieve current bar stock levels for all ingredients',
        isWrite: false,
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max items to return (default 50)' },
          },
        },
      },
      {
        name: 'search_cocktails',
        description: 'Search for cocktail recipes by name or ingredient',
        isWrite: false,
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Search term for cocktail name' },
            limit: { type: 'number', description: 'Results per page (default 10)' },
            page: { type: 'number', description: 'Page number (default 1)' },
          },
        },
      },
      {
        name: 'get_cocktail_detail',
        description: 'Get full recipe details including ingredients and instructions',
        isWrite: false,
        inputSchema: {
          type: 'object',
          properties: {
            cocktailId: { type: 'string', description: 'Cocktail ID' },
          },
          required: ['cocktailId'],
        },
      },
      {
        name: 'convert_units',
        description: 'Convert between measurement units (ml, oz, g, etc.)',
        isWrite: false,
        inputSchema: {
          type: 'object',
          properties: {
            quantity: { type: 'number', description: 'Amount to convert' },
            fromUnit: { type: 'string', description: 'Source unit (ml, oz, g, etc.)' },
            toUnit: { type: 'string', description: 'Target unit (ml, oz, g, etc.)' },
          },
          required: ['quantity', 'fromUnit', 'toUnit'],
        },
      },
      {
        name: 'prepare_cocktail',
        description: 'Enqueue a cocktail preparation order (mutates inventory)',
        isWrite: true,
        inputSchema: {
          type: 'object',
          properties: {
            cocktailId: { type: 'string', description: 'Cocktail ID to prepare' },
            servings: { type: 'number', description: 'Number of servings (default 1)' },
            force: { type: 'boolean', description: 'Force prepare with partial stock' },
          },
          required: ['cocktailId'],
        },
      },
      {
        name: 'check_makeability',
        description: 'Check if a cocktail is makeable with current bar inventory',
        isWrite: false,
        inputSchema: {
          type: 'object',
          properties: {
            cocktailId: { type: 'string', description: 'Cocktail ID to check' },
          },
          required: ['cocktailId'],
        },
      },
    ];
  }

  async executeTool(
    toolCall: McpToolCall,
    session: McpSession,
  ): Promise<McpToolResult> {
    const tool = this.getTools().find((t) => t.name === toolCall.name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${toolCall.name}` }], isError: true };
    }

    const startTime = Date.now();
    let resultStatus: 'success' | 'error' = 'error';
    let result: McpToolResult;

    try {
      result = await this.dispatchTool(toolCall, session);
      resultStatus = result.isError ? 'error' : 'success';
    } catch (error: any) {
      result = { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }

    await this.auditToolCall(tool, toolCall, resultStatus, session).catch((err) =>
      this.logger.error(`Audit failed: ${err.message}`),
    );

    return result;
  }

  private async dispatchTool(
    toolCall: McpToolCall,
    session: McpSession,
  ): Promise<McpToolResult> {
    switch (toolCall.name) {
      case 'get_bar_inventory':
        return this.handleGetBarInventory(toolCall.arguments);
      case 'search_cocktails':
        return this.handleSearchCocktails(toolCall.arguments);
      case 'get_cocktail_detail':
        return this.handleGetCocktailDetail(toolCall.arguments);
      case 'convert_units':
        return this.handleConvertUnits(toolCall.arguments);
      case 'prepare_cocktail':
        return this.handlePrepareCocktail(toolCall.arguments, session);
      case 'check_makeability':
        return this.handleCheckMakeability(toolCall.arguments);
      default:
        return { content: [{ type: 'text', text: `Tool not implemented: ${toolCall.name}` }], isError: true };
    }
  }

  private async handleGetBarInventory(args: Record<string, unknown>): Promise<McpToolResult> {
    const limit = (args.limit as number) || 50;
    const result = await this.barInventoryService.getInventory({ limit, page: 1 });
    const items = (result as any).data || result;
    const summary = (items as any[]).map((item: any) => ({
      name: item.ingredient?.name || 'Unknown',
      quantity: item.quantity?.toString(),
      unit: item.ingredient?.baseUnit || 'units',
    }));
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  }

  private async handleSearchCocktails(args: Record<string, unknown>): Promise<McpToolResult> {
    const name = (args.name as string) || '';
    const limit = (args.limit as number) || 10;
    const page = (args.page as number) || 1;
    const result = await this.aggregatorService.searchUnified(name, { limit, page });
    const cocktails = ((result as any).data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      source: c.source,
      ingredientCount: c.ingredients?.length || 0,
    }));
    return { content: [{ type: 'text', text: JSON.stringify({ cocktails, total: (result as any).meta?.totalItems || cocktails.length }, null, 2) }] };
  }

  private async handleGetCocktailDetail(args: Record<string, unknown>): Promise<McpToolResult> {
    const cocktailId = args.cocktailId as string;
    try {
      const cocktail = await this.cocktailsService.findOne(cocktailId);
      const detail = {
        id: cocktail.id,
        name: cocktail.name,
        description: cocktail.description,
        instructions: cocktail.instructions,
        ingredients: (cocktail.ingredients || []).map((ci: any) => ({
          name: ci.ingredient?.name,
          amount: ci.amount,
          unit: ci.unit,
          measure: ci.measure,
        })),
        source: cocktail.source,
      };
      return { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Cocktail not found: ${cocktailId}` }], isError: true };
    }
  }

  private async handleConvertUnits(args: Record<string, unknown>): Promise<McpToolResult> {
    const quantity = Number(args.quantity);
    const fromUnit = args.fromUnit as string;
    const toUnit = args.toUnit as string;
    try {
      const result = this.unitConverter.convert(quantity, fromUnit, toUnit);
      return { content: [{ type: 'text', text: JSON.stringify({ result: result.toString(), from: fromUnit, to: toUnit, original: quantity }) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Conversion error: ${error.message}` }], isError: true };
    }
  }

  private async handlePrepareCocktail(args: Record<string, unknown>, session: McpSession): Promise<McpToolResult> {
    const cocktailId = args.cocktailId as string;
    const servings = (args.servings as number) || 1;
    const force = !!args.force;

    const cocktailsService = this.cocktailsService as any;
    try {
      const result = await cocktailsService.prepare(cocktailId, session.userId, servings, force);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Preparation failed: ${error.message}` }], isError: true };
    }
  }

  private async handleCheckMakeability(args: Record<string, unknown>): Promise<McpToolResult> {
    const cocktailId = args.cocktailId as string;
    try {
      const cocktail = await this.cocktailsService.findOne(cocktailId);
      const inventory = await this.barInventoryService.getInventory({ limit: 200, page: 1 });
      const items = (inventory as any).data || inventory || [];
      let missing: string[] = [];
      let makeable = true;

      for (const ci of cocktail.ingredients || []) {
        const found = (items as any[]).find((item: any) => {
          const invName = item.ingredient?.name?.toLowerCase();
          const ciName = ci.ingredient?.name?.toLowerCase();
          return invName === ciName && (item.quantity?.greaterThanOrequal(ci.amount || 0) ?? true);
        });
        if (!found) {
          missing.push(ci.ingredient?.name || 'Unknown');
          makeable = false;
        }
      }

      return { content: [{ type: 'text', text: JSON.stringify({ makeable, missingIngredients: missing, cocktailName: cocktail.name }) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Check failed: ${error.message}` }], isError: true };
    }
  }

  private async auditToolCall(
    tool: McpToolDefinition,
    call: McpToolCall,
    status: 'success' | 'error',
    session: McpSession,
  ): Promise<void> {
    const sampleRate = this.configService.get<number>('AI_AUDIT_READ_SAMPLE_RATE', 10);
    const shouldAudit = tool.isWrite || Math.random() * 100 < sampleRate;
    if (!shouldAudit) return;

    const audit = this.auditRepository.create({
      toolName: call.name,
      arguments: call.arguments,
      resultStatus: status,
      isWrite: tool.isWrite,
      triggeredById: session.userId,
    });
    await this.auditRepository.save(audit);
  }
}
