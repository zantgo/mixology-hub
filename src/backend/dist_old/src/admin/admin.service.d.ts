import { Repository } from 'typeorm';
import { ReportedContent } from '../cocktails/entities/reported-content.entity';
import { HiddenExternalCocktails } from '../cocktails/entities/hidden-external-cocktails.entity';
import { SystemSettings } from '../users/entities/system-settings.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
export declare class AdminService {
    private readonly reportRepository;
    private readonly hiddenRepository;
    private readonly settingsRepository;
    private readonly ingredientRepository;
    constructor(reportRepository: Repository<ReportedContent>, hiddenRepository: Repository<HiddenExternalCocktails>, settingsRepository: Repository<SystemSettings>, ingredientRepository: Repository<Ingredient>);
    getReports(): Promise<ReportedContent[]>;
    reviewReport(id: string, status: string, reviewedBy: string): Promise<ReportedContent>;
    mergeIngredients(sourceId: string, targetId: string, adminId: string): Promise<{
        message: string;
        targetId: string;
    }>;
    hideExternalCocktail(externalId: string, reason: string, adminId: string): Promise<HiddenExternalCocktails>;
    unhideExternalCocktail(externalId: string): Promise<{
        message: string;
    }>;
    getSetting(key: string): Promise<SystemSettings>;
    setSetting(key: string, value: string, updatedBy: string): Promise<SystemSettings>;
}
