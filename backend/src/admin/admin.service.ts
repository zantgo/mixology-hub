import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportedContent } from '../cocktails/entities/reported-content.entity';
import { HiddenExternalCocktails } from '../cocktails/entities/hidden-external-cocktails.entity';
import { SystemSettings } from '../users/entities/system-settings.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(ReportedContent)
    private readonly reportRepository: Repository<ReportedContent>,
    @InjectRepository(HiddenExternalCocktails)
    private readonly hiddenRepository: Repository<HiddenExternalCocktails>,
    @InjectRepository(SystemSettings)
    private readonly settingsRepository: Repository<SystemSettings>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async getReports() {
    return this.reportRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'DESC' },
    });
  }

  async reviewReport(id: string, status: string, reviewedBy: string) {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    report.status = status;
    report.reviewedBy = { id: reviewedBy } as any;
    report.reviewedAt = new Date();
    return this.reportRepository.save(report);
  }

  async mergeIngredients(sourceId: string, targetId: string, adminId: string) {
    const source = await this.ingredientRepository.findOne({ where: { id: sourceId } });
    const target = await this.ingredientRepository.findOne({ where: { id: targetId } });

    if (!source || !target) {
      throw new NotFoundException('Source or target ingredient not found');
    }

    // Merge: move all children from source to target, then delete source
    const children = await this.ingredientRepository.find({
      where: { parent: { id: sourceId } },
    });

    for (const child of children) {
      child.parent = target;
      await this.ingredientRepository.save(child);
    }

    await this.ingredientRepository.remove(source);

    return { message: 'Ingredients merged successfully', targetId };
  }

  async hideExternalCocktail(externalId: string, reason: string, adminId: string) {
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
      hiddenBy: { id: adminId } as any,
    });

    return this.hiddenRepository.save(hidden);
  }

  async unhideExternalCocktail(externalId: string) {
    await this.hiddenRepository.delete({ externalId });
    return { message: 'External cocktail unhidden' };
  }

  async getSetting(key: string) {
    const setting = await this.settingsRepository.findOne({ where: { settingKey: key } });
    if (!setting) {
      throw new NotFoundException('Setting not found');
    }
    return setting;
  }

  async setSetting(key: string, value: string, updatedBy: string) {
    let setting = await this.settingsRepository.findOne({ where: { settingKey: key } });

    if (!setting) {
      setting = this.settingsRepository.create({
        settingKey: key,
        settingValue: value,
        updatedBy: { id: updatedBy } as any,
      });
    } else {
      setting.settingValue = value;
      setting.updatedBy = { id: updatedBy } as any;
    }

    return this.settingsRepository.save(setting);
  }
}
