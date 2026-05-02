import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cocktail } from '../entities/cocktail.entity';
import { User } from '../../users/entities/user.entity';
import { EnhancedTheCocktailDbService } from '../../external/the-cocktail-db/enhanced-cocktail-db.service';

export interface RatingDto {
  score: number; // 1-5
}

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Cocktail)
    private cocktailRepository: Repository<Cocktail>,
    private externalCocktailService: EnhancedTheCocktailDbService,
  ) {}

  async rateCocktail(user: User, cocktailId: string, ratingDto: RatingDto): Promise<{ averageRating: number; userRating: number }> {
    // Validate score
    if (ratingDto.score < 1 || ratingDto.score > 5) {
      throw new BadRequestException('Rating score must be between 1 and 5');
    }

    // Check if cocktail exists locally
    let cocktail = await this.cocktailRepository.findOne({
      where: { id: cocktailId, is_deleted: false },
    });

    // If not found locally, check if it's an external cocktail ID
    if (!cocktail) {
      cocktail = await this.handleExternalCocktailRating(user, cocktailId);
    }

    if (!cocktail) {
      throw new NotFoundException('Cocktail not found');
    }

    // TODO: Implement actual rating logic
    // This would involve:
    // 1. Creating/updating rating in COCKTAIL_RATINGS table
    // 2. Calculating new average rating
    // 3. Updating cached rating on cocktail
    // 4. Triggering async job for rating recalculation

    // For now, return mock data
    return {
      averageRating: 4.2,
      userRating: ratingDto.score,
    };
  }

  private async handleExternalCocktailRating(user: User, externalId: string): Promise<Cocktail | null> {
    try {
      // Fetch external cocktail details
      const externalCocktail = await this.externalCocktailService.getCocktailById(externalId);
      
      if (!externalCocktail) {
        return null;
      }

      // Auto-fork: Create local copy of external cocktail
      const raw = externalCocktail as Record<string, any>;
      const forked = new Cocktail();
      forked.name = raw.strDrink || raw.name || 'Unknown';
      forked.description = raw.strInstructions || raw.instructions || '';
      forked.instructions = raw.strInstructions || raw.instructions || '';
      forked.source = 'api';
      forked.external_id = externalId;
      forked.user = user;
      forked.is_public = false;
      forked.is_deleted = false;

      // TODO: Also fork ingredients if needed

      return await this.cocktailRepository.save(forked);
    } catch (error) {
      console.error('Failed to fork external cocktail:', error);
      return null;
    }
  }

  async getUserRating(user: User, cocktailId: string): Promise<number | null> {
    // TODO: Query COCKTAIL_RATINGS table for user's rating
    // For now, return mock data
    return null;
  }

  async getCocktailAverageRating(cocktailId: string): Promise<number | null> {
    // TODO: Query cached rating from COCKTAILS table or calculate from COCKTAIL_RATINGS
    // For now, return mock data
    return 4.2;
  }
}