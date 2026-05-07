import { GdprDataRetentionService } from './gdpr-data-retention.service';
export declare class GdprController {
    private readonly gdprService;
    constructor(gdprService: GdprDataRetentionService);
    exportUserData(req: any): Promise<{
        success: boolean;
        data: any;
        exportedAt: string;
    }>;
    requestAccountDeletion(req: any): Promise<{
        success: boolean;
        message: string;
        deletedAt: string;
    }>;
    getRetentionStats(req: any): Promise<{
        success: boolean;
        stats: any;
        requestedBy: any;
    }>;
    runCleanup(req: any): Promise<{
        success: boolean;
        message: string;
        triggeredAt: string;
        triggeredBy: any;
    }>;
}
