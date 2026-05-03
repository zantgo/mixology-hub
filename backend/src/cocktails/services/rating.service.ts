import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import { Cocktail } from '../entities/cocktail.entity';
import { CocktailRating } from '../entities/cocktail-rating.entity';
import { User } from '../../users/entities/user.entity';
import { EnhancedTheCocktailDbService } from '../../external/the-cocktail-db/enhanced-cocktail-db.service';
import { RateCocktailDto } from '../dto/rate-cocktail.dto';

@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);

  constructor(
    @InjectRepository(Cocktail)
    private cocktailRepository: Repository<Cocktail>,
    @InjectRepository(CocktailRating)
    private ratingRepository: Repository<CocktailRating>,
    private externalCocktailService: EnhancedTheCocktailDbService,
  ) {}

  async rateCocktail(
    user: User,
    cocktailId: string,
    ratingDto: RateCocktailDto,
  ): Promise<{ averageRating: number; userRating: number; ratingCount: number }> {
    let cocktail = await this.cocktailRepository.findOne({
      where: { id: cocktailId, is_deleted: false },
    });

    if (!cocktail) {
      cocktail = await this.handleExternalCocktailRating(user, cocktailId);
    }

    if (!cocktail) {
      throw new NotFoundException('Cocktail not found');
    }

    const existingRating = await this.ratingRepository.findOne({
      where: { user: { id: user.id }, cocktail: { id: cocktail.id } },
    });

    if (existingRating) {
      existingRating.score = ratingDto.score;
      await this.ratingRepository.save(existingRating);
    } else {
      const newRating = this.ratingRepository.create({
        user,
        cocktail,
        score: ratingDto.score,
      });
      await this.ratingRepository.save(newRating);
    }

    const [ratings, count] = await this.ratingRepository.findAndCount({
      where: { cocktail: { id: cocktail.id } },
    });

    const avg =
      ratings.reduce((sum, r) => sum.plus(new Decimal(r.score)), new Decimal(0))
        .div(count)
        .toDecimalPlaces(2)
        .toNumber();

    cocktail.rating = avg;
    cocktail.rating_count = count;
    await this.cocktailRepository.save(cocktail);

    return { averageRating: avg, userRating: ratingDto.score, ratingCount: count };
  }

  async getUserRating(user: User, cocktailId: string): Promise<number | null> {
    const rating = await this.ratingRepository.findOne({
      where: { user: { id: user.id }, cocktail: { id: cocktailId } },
    });
    return rating ? rating.score : null;
  }

  async getCocktailAverageRating(cocktailId: string): Promise<number | null> {
    const cocktail = await this.cocktailRepository.findOne({
      where: { id: cocktailId, is_deleted: false },
    });
    return cocktail?.rating ?? null;
  }

  private async handleExternalCocktailRating(user: User, externalId: string): Promise<Cocktail | null> {
    try {
      const externalCocktail = await this.externalCocktailService.getCocktailById(externalId);
      if (!externalCocktail) return null;

      const raw = externalCocktail as Record<string, any>;
      const forked = new Cocktail();
      forked.name = raw.strDrink || raw.name || 'Unknown';
      forked.description = raw.strInstructions || raw.instructions || '';
      forked.instructions = raw.strInstructions || raw.instructions || '';
      forked.source = 'local';
      forked.parent_external_id = externalId;
      forked.user = user;
      forked.is_public = false;
      forked.is_deleted = false;

      return await this.cocktailRepository.save(forked);
    } catch (error) {
      this.logger.error('Failed to fork external cocktail:', error);
      return null;
    }
  }
}
