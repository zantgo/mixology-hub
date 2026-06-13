import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReportedContent } from '../cocktails/entities/reported-content.entity';
import { HiddenExternalCocktails } from '../cocktails/entities/hidden-external-cocktails.entity';
import { SystemSettings } from '../users/entities/system-settings.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ReportedContent)
    private readonly reportRepository: Repository<ReportedContent>,
    @InjectRepository(HiddenExternalCocktails)
    private readonly hiddenRepository: Repository<HiddenExternalCocktails>,
    @InjectRepository(SystemSettings)
    private readonly settingsRepository: Repository<SystemSettings>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
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
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    report.status = status;
    report.reviewedBy = { id: reviewedBy } as User;
    report.reviewedAt = new Date();
    return this.reportRepository.save(report);
  }

  async mergeIngredients(sourceId: string, targetId: string) {
    return await this.dataSource.transaction(async (manager) => {
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
