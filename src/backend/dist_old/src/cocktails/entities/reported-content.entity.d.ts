import { User } from '../../users/entities/user.entity';
import { Cocktail } from './cocktail.entity';
export declare class ReportedContent {
    id: string;
    reportedBy: User | null;
    cocktail: Cocktail | null;
    externalCocktailId: string;
    reportReason: string;
    details: string;
    status: string;
    reviewedBy: User | null;
    createdAt: Date;
    reviewedAt: Date | null;
}
