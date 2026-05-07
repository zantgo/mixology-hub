import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getReports(): Promise<import("../cocktails/entities/reported-content.entity").ReportedContent[]>;
    reviewReport(id: string, status: string, reviewedBy: string): Promise<import("../cocktails/entities/reported-content.entity").ReportedContent>;
    mergeIngredients(sourceId: string, targetId: string, adminId: string): Promise<{
        message: string;
        targetId: string;
    }>;
    hideExternalCocktail(externalId: string, reason: string, adminId: string): Promise<import("../cocktails/entities/hidden-external-cocktails.entity").HiddenExternalCocktails>;
    unhideExternalCocktail(externalId: string): Promise<{
        message: string;
    }>;
    getSetting(key: string): Promise<import("../users/entities/system-settings.entity").SystemSettings>;
    setSetting(key: string, value: string, updatedBy: string): Promise<import("../users/entities/system-settings.entity").SystemSettings>;
}
