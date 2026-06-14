import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import { BarInventoryService } from '../inventory/bar-inventory.service';
import { CocktailAggregatorService } from '../cocktails/cocktail-aggregator.service';
import { CocktailsService } from '../cocktails/cocktails.service';
import { UnitConverterService } from '../utils/unit-converter.service';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
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
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

@Injectable()
export class McpServerService implements OnApplicationShutdown {
  private readonly logger = new Logger(McpServerService.name);
  private readonly rateLimiter = new Map<string, number[]>();
  private readonly RATE_LIMIT = 30;
  private readonly RATE_WINDOW_MS = 60000;
  private readonly SESSION_TTL_MS = 30 * 60 * 1000;
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private readonly barInventoryService: BarInventoryService,
    private readonly aggregatorService: CocktailAggregatorService,
    private readonly cocktailsService: CocktailsService,
    private readonly unitConverter: UnitConverterService,
    private readonly hierarchicalService: HierarchicalIngredientService,
    @InjectQueue('bar-orders')
    private readonly barOrdersQueue: Queue,
    @InjectRepository(AiToolAudit)
    private readonly auditRepository: Repository<AiToolAudit>,
    private readonly configService: ConfigService,
  ) {
    this.cleanupInterval = setInterval(() => {
      this.purgeExpiredRateLimiterKeys();
    }, this.RATE_WINDOW_MS);
  }

  onApplicationShutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private purgeExpiredRateLimiterKeys(): void {
    const now = Date.now();
    const windowStart = now - this.RATE_WINDOW_MS;
    let purged = 0;

    for (const [key, timestamps] of this.rateLimiter.entries()) {
      const recent = timestamps.filter((t) => t >= windowStart);
      if (recent.length === 0) {
        this.rateLimiter.delete(key);
        purged++;
      } else {
        this.rateLimiter.set(key, recent);
      }
    }

    if (purged > 0) {
      this.logger.debug(`Purged ${purged} expired rate limiter entries`);
    }
  }

  getTools(): McpToolDefinition[] {
    return [
      {
        name: 'get_bar_inventory',
        description: 'Retrieve current bar stock levels for all ingredients',
        isWrite: false,
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Max items to return (default 50)',
            },
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
            name: {
              type: 'string',
              description: 'Search term for cocktail name',
            },
            limit: {
              type: 'number',
              description: 'Results per page (default 10)',
            },
            page: { type: 'number', description: 'Page number (default 1)' },
          },
        },
      },
      {
        name: 'get_cocktail_detail',
        description:
          'Get full recipe details including ingredients and instructions',
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
            fromUnit: {
              type: 'string',
              description: 'Source unit (ml, oz, g, etc.)',
            },
            toUnit: {
              type: 'string',
              description: 'Target unit (ml, oz, g, etc.)',
            },
            ingredient: {
              type: 'string',
              description:
                'Ingredient name for density-based conversion (required for mass<->volume)',
            },
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
            cocktailId: {
              type: 'string',
              description: 'Cocktail ID to prepare',
            },
            servings: {
              type: 'number',
              description: 'Number of servings (default 1)',
            },
            force: {
              type: 'boolean',
              description: 'Force prepare with partial stock',
            },
          },
          required: ['cocktailId'],
        },
      },
      {
        name: 'check_makeability',
        description:
          'Check if a cocktail is makeable with current bar inventory',
        isWrite: false,
        inputSchema: {
          type: 'object',
          properties: {
            cocktailId: { type: 'string', description: 'Cocktail ID to check' },
          },
          required: ['cocktailId'],
        },
      },
      {
        name: 'get_preparation_status',
        description:
          'Get the real-time status of a queued cocktail preparation order',
        isWrite: false,
        inputSchema: {
          type: 'object',
          properties: {
            preparationLogId: {
              type: 'string',
              description: 'The UUID of the preparation log',
            },
          },
          required: ['preparationLogId'],
        },
      },
    ];
  }

  async executeTool(
    toolCall: McpToolCall,
    session: McpSession,
  ): Promise<McpToolResult> {
    if (session.ticketId !== 'stdio-session') {
      const elapsed = Date.now() - new Date(session.createdAt).getTime();
      if (elapsed > this.SESSION_TTL_MS) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: MCP session has expired. Re-authenticate.',
            },
          ],
          isError: true,
        };
      }
    }

    const sessionId = session.userId || 'anonymous';
    const now = Date.now();
    const windowStart = now - this.RATE_WINDOW_MS;

    let timestamps = this.rateLimiter.get(sessionId);
    if (!timestamps) {
      timestamps = [];
      this.rateLimiter.set(sessionId, timestamps);
    }

    timestamps.push(now);

    const recentCalls = timestamps.filter((t) => t >= windowStart);
    this.rateLimiter.set(sessionId, recentCalls);

    if (recentCalls.length > this.RATE_LIMIT) {
      return {
        content: [
          {
            type: 'text',
            text: 'Rate limit exceeded: 30 calls per 60 seconds',
          },
        ],
        isError: true,
      };
    }

    const tool = this.getTools().find((t) => t.name === toolCall.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolCall.name}` }],
        isError: true,
      };
    }

    let resultStatus: 'success' | 'error' = 'error';
    let result: McpToolResult;

    if (tool.inputSchema) {
      const validate = ajv.compile(tool.inputSchema);
      const valid = validate(toolCall.arguments || {});
      if (!valid) {
        const errors = validate.errors?.map(
          (e) => `${(e as any).instancePath || ''} ${e.message}`,
        );
        return {
          content: [
            {
              type: 'text',
              text: `Invalid parameters: ${errors?.join('; ') || 'unknown'}`,
            },
          ],
          isError: true,
        };
      }
    }

    try {
      result = await this.dispatchTool(toolCall, session);
      resultStatus = result.isError ? 'error' : 'success';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }

    await this.auditToolCall(tool, toolCall, resultStatus, session).catch(
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Audit failed: ${message}`);
      },
    );

    return result;
  }

  private async dispatchTool(
    toolCall: McpToolCall,
    _session: McpSession,
  ): Promise<McpToolResult> {
    void _session;
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
        return this.handlePrepareCocktail(toolCall.arguments, _session);
      case 'check_makeability':
        return this.handleCheckMakeability(toolCall.arguments);
      case 'get_preparation_status':
        return this.handleGetPreparationStatus(toolCall.arguments);
      default:
        return {
          content: [
            { type: 'text', text: `Tool not implemented: ${toolCall.name}` },
          ],
          isError: true,
        };
    }
  }

  private async handleGetBarInventory(
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const limit = (args.limit as number) || 50;
    const result = await this.barInventoryService.getInventory({
      limit,
      page: 1,
    });
    interface InventoryItem {
      ingredient?: { name?: string; baseUnit?: string };
      quantity?: { toString: () => string };
    }
    interface InventoryResult {
      data?: InventoryItem[];
    }
    const typedResult = result as InventoryResult;
    const items = typedResult.data || (result as unknown as InventoryItem[]);
    const summary = (Array.isArray(items) ? items : []).map(
      (item: InventoryItem) => ({
        name: item.ingredient?.name || 'Unknown',
        quantity: item.quantity?.toString(),
        unit: item.ingredient?.baseUnit || 'units',
      }),
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
    };
  }

  private async handleSearchCocktails(
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const name = (args.name as string) || '';
    const limit = (args.limit as number) || 10;
    const page = (args.page as number) || 1;
    const result = await this.aggregatorService.searchUnified(name, {
      limit,
      page,
    });
    interface CocktailSummary {
      id: string;
      name: string;
      source: string;
      ingredients?: unknown[];
      isMakeable?: boolean | null;
      makeabilityScore?: number | null;
    }
    interface SearchResult {
      data?: CocktailSummary[];
      meta?: { totalItems?: number };
    }
    const typedResult = result as SearchResult;
    const cocktails = (typedResult.data || []).map((c: CocktailSummary) => ({
      id: c.id,
      name: c.name,
      source: c.source,
      ingredientCount: c.ingredients?.length || 0,
      makeable: c.isMakeable ?? null,
      makeabilityScore: c.makeabilityScore ?? null,
    }));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              cocktails,
              total: typedResult.meta?.totalItems || cocktails.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleGetCocktailDetail(
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const cocktailId = args.cocktailId as string;
    try {
      const cocktail = await this.cocktailsService.findOne(cocktailId);
      interface CocktailIngredientRef {
        ingredient?: { name?: string } | null;
        amount?: unknown;
        unit?: string;
        measure?: string;
      }
      const detail = {
        id: cocktail.id,
        name: cocktail.name,
        description: cocktail.description,
        instructions: cocktail.instructions,
        ingredients: (cocktail.ingredients || []).map(
          (ci: CocktailIngredientRef) => ({
            name: ci.ingredient?.name,
            amount: ci.amount,
            unit: ci.unit,
            measure: ci.measure,
          }),
        ),
        source: (cocktail as { source?: string }).source,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }],
      };
    } catch {
      return {
        content: [{ type: 'text', text: `Cocktail not found: ${cocktailId}` }],
        isError: true,
      };
    }
  }

  private async handleConvertUnits(
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const quantity = Number(args.quantity);
    const fromUnit = args.fromUnit as string;
    const toUnit = args.toUnit as string;
    const ingredientName = args.ingredient as string | undefined;

    try {
      let ingredientEntity: unknown = undefined;
      if (ingredientName) {
        const match =
          await this.hierarchicalService.findBestMatch(ingredientName);
        if (match) {
          ingredientEntity = match.ingredient;
        }
      }

      const result = this.unitConverter.convert(
        quantity,
        fromUnit,
        toUnit,
        ingredientEntity as Parameters<typeof this.unitConverter.convert>[3],
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              result: result.toString(),
              from: fromUnit,
              to: toUnit,
              original: quantity,
            }),
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Conversion error: ${message}` }],
        isError: true,
      };
    }
  }

  private async handlePrepareCocktail(
    args: Record<string, unknown>,
    session: McpSession,
  ): Promise<McpToolResult> {
    const cocktailId = args.cocktailId as string;
    const servings = (args.servings as number) || 1;
    const force = !!args.force;

    try {
      const result = await this.cocktailsService.prepare(
        cocktailId,
        session.userId,
        servings,
        undefined,
        force,
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Preparation failed: ${message}` }],
        isError: true,
      };
    }
  }

  private async handleCheckMakeability(
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const cocktailId = args.cocktailId as string;
    try {
      const cocktail = await this.cocktailsService.findOne(cocktailId);
      const inventory = await this.barInventoryService.getInventory({
        limit: 200,
        page: 1,
      });
      interface InventoryItemWithIngredient {
        ingredient?: { id?: string; name?: string; baseUnit?: string };
        quantity?: Decimal;
      }
      interface InventoryResult {
        data?: InventoryItemWithIngredient[];
      }
      const typedInventory = inventory as InventoryResult;
      const items =
        typedInventory.data ||
        (inventory as unknown as InventoryItemWithIngredient[]) ||
        [];
      const missing: string[] = [];
      let matchedCount = new Decimal(0);
      const totalIngredients = (cocktail.ingredients || []).length || 1;

      for (const ci of cocktail.ingredients || []) {
        const requiredName = ci.ingredient?.name?.toLowerCase().trim();
        const requiredId = ci.ingredient?.id;
        let found = false;

        const directMatch = items.find(
          (item: InventoryItemWithIngredient) =>
            item.ingredient?.id === requiredId ||
            item.ingredient?.name?.toLowerCase().trim() === requiredName,
        );
        if (directMatch && ci.amount) {
          try {
            const requiredInBase = this.unitConverter.convert(
              ci.amount,
              ci.unit,
              ci.ingredient.baseUnit,
              ci.ingredient,
            );
            const hasEnough = directMatch.quantity?.gte(requiredInBase);
            if (hasEnough) {
              matchedCount = matchedCount.plus(1);
              found = true;
            }
          } catch {
            if (directMatch.quantity?.gte(ci.amount || 0)) {
              matchedCount = matchedCount.plus(1);
              found = true;
            }
          }
        } else if (directMatch && !ci.amount) {
          matchedCount = matchedCount.plus(1);
          found = true;
        }

        if (!found && requiredName) {
          try {
            const match = await this.hierarchicalService.findBestMatch(
              requiredName,
              {
                includeHierarchical: true,
                includeSynonyms: true,
                minConfidence: 0.7,
              },
            );
            if (match && match.confidence >= 0.8) {
              const substitute = items.find(
                (item: InventoryItemWithIngredient) =>
                  item.ingredient?.id === match.ingredient.id,
              );
              if (substitute && ci.amount) {
                try {
                  const requiredInBase = this.unitConverter.convert(
                    ci.amount,
                    ci.unit,
                    match.ingredient.baseUnit,
                    match.ingredient,
                  );
                  if (substitute.quantity?.gte(requiredInBase)) {
                    matchedCount = matchedCount.plus(
                      new Decimal(match.confidence),
                    );
                    found = true;
                  }
                } catch {
                  // Unit conversion failed
                }
              } else if (substitute && !ci.amount) {
                matchedCount = matchedCount.plus(new Decimal(match.confidence));
                found = true;
              }
            }
          } catch {
            // no-op: skip unmatched ingredients
          }
        }

        if (!found) {
          missing.push(ci.ingredient?.name || 'Unknown');
        }
      }

      const score = matchedCount.div(totalIngredients).toNumber();
      const makeable = score >= 1.0;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              makeable,
              matchScore: Math.round(score * 100) / 100,
              missingIngredients: missing,
              cocktailName: cocktail.name,
            }),
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Check failed: ${message}` }],
        isError: true,
      };
    }
  }

  private async handleGetPreparationStatus(
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const preparationLogId = args.preparationLogId as string;
    try {
      const status =
        await this.cocktailsService.getPreparationStatus(preparationLogId);
      return {
        content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Failed to fetch status: ${message}` }],
        isError: true,
      };
    }
  }

  private async auditToolCall(
    tool: McpToolDefinition,
    call: McpToolCall,
    status: 'success' | 'error',
    session: McpSession,
  ): Promise<void> {
    const rawSampleRate = this.configService.get<string | number>(
      'AI_AUDIT_READ_SAMPLE_RATE',
      10,
    );
    const sampleRate =
      typeof rawSampleRate === 'string'
        ? parseFloat(rawSampleRate)
        : rawSampleRate;
    const shouldAudit = tool.isWrite || Math.random() * 100 < sampleRate;
    if (!shouldAudit) return;

    const argsSize = JSON.stringify(call.arguments || {}).length;
    const estimatedTokens = Math.ceil(argsSize / 4);

    const audit = this.auditRepository.create({
      toolName: call.name,
      arguments: call.arguments,
      resultStatus: status,
      isWrite: tool.isWrite,
      tokensUsed: estimatedTokens,
      triggeredById: session.userId,
    });
    await this.auditRepository.save(audit);
  }
}
