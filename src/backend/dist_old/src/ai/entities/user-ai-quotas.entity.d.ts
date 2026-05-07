import { User } from '../../users/entities/user.entity';
export declare class UserAiQuotas {
    id: string;
    user: User;
    quotaDate: string;
    usageCount: number;
    lastUpdatedAt: Date;
}
