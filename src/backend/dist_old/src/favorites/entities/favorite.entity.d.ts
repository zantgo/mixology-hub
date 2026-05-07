import { User } from '../../users/entities/user.entity';
import { Cocktail } from '../../cocktails/entities/cocktail.entity';
export declare class Favorite {
    id: string;
    user: User;
    cocktail: Cocktail | null;
    external_cocktail_id: string | null;
    created_at: Date;
}
