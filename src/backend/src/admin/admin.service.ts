import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReportedContent } from '../cocktails/entities/reported-content.entity';
import { HiddenExternalCocktail } from '../cocktails/entities/hidden-external-cocktail.entity';
import { SystemSetting } from '../users/entities/system-setting.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { EmailService } from '../email/email.service';
import { HierarchicalIngredientService } from '../ingredients/hierarchical-ingredient.service';
import { Decimal } from 'decimal.js';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private static readonly ALLOWED_SETTING_KEYS = new Set([
    'global_token_salt_version',
  ]);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ReportedContent)
    private readonly reportRepository: Repository<ReportedContent>,
    @InjectRepository(HiddenExternalCocktail)
    private readonly hiddenRepository: Repository<HiddenExternalCocktail>,
    @InjectRepository(SystemSetting)
    private readonly settingsRepository: Repository<SystemSetting>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly emailService: EmailService,
    private readonly hierarchicalService: HierarchicalIngredientService,
  ) {}

  async getReports(paginationQuery: PaginationQueryDto) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;
    const [data, total] = await this.reportRepository.findAndCount({
      where: { status: 'pending' },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    return {
      data,
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
      },
    };
  }

  async reviewReport(id: string, status: string, reviewedBy: string) {
    return await this.dataSource.transaction(async (manager) => {
      const report = await manager.findOne(ReportedContent, {
        where: { id },
        relations: ['reportedBy', 'cocktail', 'cocktail.user'],
      });

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      report.status = status;
      report.reviewedBy = { id: reviewedBy } as User;
      report.reviewedAt = new Date();

      if (status === 'resolved') {
        if (report.cocktail) {
          const cocktail = report.cocktail;
          const author = cocktail.user;

          const imageFull = cocktail.imageFull;
          const imageThumb = cocktail.imageThumb;

          await manager.remove(Cocktail, cocktail);

          report.cocktail = null;

          if (imageFull || imageThumb) {
            const uploadsDir = path.join(process.cwd(), 'uploads', 'cocktails');
            if (imageFull) {
              const fullPath = path.join(uploadsDir, path.basename(imageFull));
              await fs.unlink(fullPath).catch((err: NodeJS.ErrnoException) => {
                if (err.code !== 'ENOENT') {
                  this.logger.error(
                    `Failed to delete full image: ${fullPath}`,
                    err.stack,
                  );
                }
              });
            }
            if (imageThumb) {
              const thumbPath = path.join(
                uploadsDir,
                path.basename(imageThumb),
              );
              await fs.unlink(thumbPath).catch((err: NodeJS.ErrnoException) => {
                if (err.code !== 'ENOENT') {
                  this.logger.error(
                    `Failed to delete thumb image: ${thumbPath}`,
                    err.stack,
                  );
                }
              });
            }
          }

          if (report.reportedBy && report.reportedBy.email) {
            this.emailService
              .sendModerationNotification(
                report.reportedBy.email,
                'MixologyHub — Update on Your Report',
                `Your report has been reviewed. The recipe "${cocktail.name}" has been removed for violating our community guidelines.`,
              )
              .catch((err: Error) => {
                this.logger.error(
                  `Reporter notification failed: ${err.message}`,
                );
              });
          }

          if (author && author.email && !author.isAnonymized) {
            this.emailService
              .sendModerationNotification(
                author.email,
                'MixologyHub — Content Moderation Notice',
                `Your recipe "${cocktail.name}" was reviewed by an administrator and has been permanently removed for violating our community guidelines.`,
              )
              .catch((err: Error) => {
                this.logger.error(
                  `Author warning dispatch failed: ${err.message}`,
                );
              });
          }
        } else if (report.externalCocktailId) {
          let hidden = await manager.findOne(HiddenExternalCocktail, {
            where: { externalId: report.externalCocktailId },
          });
          if (!hidden) {
            hidden = manager.create(HiddenExternalCocktail, {
              externalId: report.externalCocktailId,
              reason: report.reportReason || 'Reported Content Resolved',
              hiddenBy: { id: reviewedBy },
            });
            await manager.save(HiddenExternalCocktail, hidden);
          }

          if (report.reportedBy && report.reportedBy.email) {
            this.emailService
              .sendModerationNotification(
                report.reportedBy.email,
                'MixologyHub — Update on Your Report',
                `Your report has been reviewed. The external recipe #${report.externalCocktailId} has been blacklisted and hidden from all future search results.`,
              )
              .catch((err: Error) => {
                this.logger.error(
                  `Reporter notification failed: ${err.message}`,
                );
              });
          }
        }
      }

      return await manager.save(ReportedContent, report);
    });
  }

  async mergeIngredients(sourceId: string, targetId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const source = await manager.findOne(Ingredient, {
        where: { id: sourceId },
      });
      const target = await manager.findOne(Ingredient, {
        where: { id: targetId },
      });

      if (!source || !target) {
        throw new NotFoundException('Source or target ingredient not found');
      }

      if (source.baseUnit !== target.baseUnit) {
        throw new ConflictException(
          `Cannot merge ingredients: Base unit mismatch (${source.baseUnit} vs ${target.baseUnit}).`,
        );
      }

      await manager
        .createQueryBuilder()
        .update(CocktailIngredient)
        .set({ ingredient: target })
        .where('ingredient_id = :sourceId', { sourceId })
        .execute();

      const sourceStock = await manager.findOne(BarInventory, {
        where: { ingredient: { id: sourceId } },
      });
      const targetStock = await manager.findOne(BarInventory, {
        where: { ingredient: { id: targetId } },
      });

      if (sourceStock) {
        if (targetStock) {
          const combinedQty = new Decimal(targetStock.quantity.toString()).plus(
            new Decimal(sourceStock.quantity.toString()),
          );
          targetStock.quantity = combinedQty;
          await manager.save(targetStock);
          await manager.remove(sourceStock);
        } else {
          sourceStock.ingredient = target;
          await manager.save(sourceStock);
        }
      }

      await manager
        .createQueryBuilder()
        .update(Ingredient)
        .set({ parentId: targetId })
        .where('parent_id = :sourceId', { sourceId })
        .execute();

      await manager.remove(source);

      return { message: 'Ingredients merged successfully', targetId };
    });

    await this.hierarchicalService.clearCache();

    return result;
  }

  async mapSynonym(ingredientId: string, synonym: string) {
    const ingredient = await this.ingredientRepository.findOne({
      where: { id: ingredientId },
    });
    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    const normalizedSynonym = synonym.toLowerCase().trim();
    const existingSynonyms = ingredient.synonyms
      ? ingredient.synonyms.split(',').map((s) => s.toLowerCase().trim())
      : [];

    if (existingSynonyms.includes(normalizedSynonym)) {
      throw new ConflictException(
        'Synonym is already mapped to this ingredient.',
      );
    }

    existingSynonyms.push(normalizedSynonym);
    ingredient.synonyms = existingSynonyms.join(',');

    return await this.ingredientRepository.save(ingredient);
  }

  async hideExternalCocktail(
    externalId: string,
    reason: string,
    adminId: string,
  ) {
    const existing = await this.hiddenRepository.findOne({
      where: { externalId },
    });

    if (existing) {
      existing.reason = reason;
      return this.hiddenRepository.save(existing);
    }

    const hidden = this.hiddenRepository.create({
      externalId,
      reason,
      hiddenBy: { id: adminId },
    });

    return this.hiddenRepository.save(hidden);
  }

  async unhideExternalCocktail(externalId: string) {
    await this.hiddenRepository.delete({ externalId });
    return { message: 'External cocktail unhidden' };
  }

  async promoteIngredient(id: string) {
    const ingredient = await this.ingredientRepository.findOne({
      where: { id },
    });
    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }
    if (ingredient.isGlobal) {
      throw new BadRequestException('Ingredient is already global');
    }
    ingredient.isGlobal = true;
    await this.ingredientRepository.save(ingredient);

    await this.hierarchicalService.clearCache();

    return { message: 'Ingredient promoted to global catalog' };
  }

  async getSetting(key: string) {
    const setting = await this.settingsRepository.findOne({
      where: { settingKey: key },
    });
    if (!setting) {
      throw new NotFoundException('Setting not found');
    }
    return setting;
  }

  async setSetting(key: string, value: string, updatedBy: string) {
    if (!AdminService.ALLOWED_SETTING_KEYS.has(key)) {
      throw new BadRequestException(`Setting key "${key}" is not allowed`);
    }

    let setting = await this.settingsRepository.findOne({
      where: { settingKey: key },
    });

    if (!setting) {
      setting = this.settingsRepository.create({
        settingKey: key,
        settingValue: value,
        updatedBy: { id: updatedBy },
      });
    } else {
      setting.settingValue = value;
      setting.updatedBy = { id: updatedBy } as User;
    }

    return this.settingsRepository.save(setting);
  }
}
