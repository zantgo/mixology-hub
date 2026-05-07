import { User } from '../../users/entities/user.entity';
export declare class HiddenExternalCocktails {
    externalId: string;
    hiddenBy: User | null;
    reason: string;
    createdAt: Date;
}
