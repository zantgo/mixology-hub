import { Repository } from 'typeorm';
import { Cocktail } from '../entities/cocktail.entity';
import { User } from '../../users/entities/user.entity';
import { EnhancedTheCocktailDbService } from '../../external/the-cocktail-db/enhanced-cocktail-db.service';
export interface RatingDto {
    score: number;
}
export declare class RatingService {
    private cocktailRepository;
    private externalCocktailService;
    constructor(cocktailRepository: Repository<Cocktail>, externalCocktailService: EnhancedTheCocktailDbService);
    rateCocktail(user: User, cocktailId: string, ratingDto: RatingDto): Promise<{
        averageRating: number;
        userRating: number;
    }>;
    private handleExternalCocktailRating;
    getUserRating(user: User, cocktailId: string): Promise<number | null>;
    getCocktailAverageRating(cocktailId: string): Promise<number | null>;
}
