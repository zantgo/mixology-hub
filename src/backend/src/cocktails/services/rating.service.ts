import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import { Cocktail } from '../entities/cocktail.entity';
import { CocktailRating } from '../entities/cocktail-rating.entity';
import { ExternalCocktailRating } from '../entities/external-cocktail-rating.entity';
import { User } from '../../users/entities/user.entity';
import { RateCocktailDto } from '../dto/rate-cocktail.dto';

@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);

  constructor(
    @InjectRepository(Cocktail)
    private cocktailRepository: Repository<Cocktail>,
    @InjectRepository(CocktailRating)
    private ratingRepository: Repository<CocktailRating>,
    @InjectRepository(ExternalCocktailRating)
    private externalRatingRepository: Repository<ExternalCocktailRating>,
  ) {}

  async rateCocktail(
    user: User,
    cocktailId: string,
    ratingDto: RateCocktailDto,
  ): Promise<{
    averageRating: number;
    userRating: number;
    ratingCount: number;
  }> {
    // Try local lookup by UUID first
    let cocktail = await this.cocktailRepository.findOne({
      where: { id: cocktailId, is_deleted: false },
    });

    // If not found by UUID, try finding a local fork by parent_external_id
    if (!cocktail) {
      const cleanId = cocktailId.startsWith('ext-')
        ? cocktailId.slice(4)
        : cocktailId;
      cocktail = await this.cocktailRepository.findOne({
        where: { parent_external_id: cleanId, is_deleted: false },
      });
    }

    if (cocktail) {
      // Local cocktail (native or previously forked) — store in cocktail_ratings
      return this.rateLocalCocktail(user, cocktail, ratingDto.score);
    }

    // Not a local cocktail — store in external_cocktail_ratings table
    const externalId = cocktailId.startsWith('ext-')
      ? cocktailId.slice(4)
      : cocktailId;
    return this.rateExternalCocktail(user, externalId, ratingDto.score);
  }

  async getUserRating(user: User, cocktailId: string): Promise<number | null> {
    // Try local rating first
    const localRating = await this.ratingRepository.findOne({
      where: { user: { id: user.id }, cocktail: { id: cocktailId } },
    });
    if (localRating) {
      return localRating.score;
    }

    // If not found locally, try by parent_external_id
    const cocktail = await this.cocktailRepository.findOne({
      where: { parent_external_id: cocktailId, is_deleted: false },
    });
    if (cocktail) {
      const forkRating = await this.ratingRepository.findOne({
        where: { user: { id: user.id }, cocktail: { id: cocktail.id } },
      });
      if (forkRating) {
        return forkRating.score;
      }
    }

    // Try external rating table
    const cleanId = cocktailId.startsWith('ext-')
      ? cocktailId.slice(4)
      : cocktailId;
    const externalRating = await this.externalRatingRepository.findOne({
      where: { user: { id: user.id }, external_cocktail_id: cleanId },
    });
    return externalRating ? externalRating.score : null;
  }

  async getCocktailAverageRating(cocktailId: string): Promise<number | null> {
    // Try local cocktail first
    const cocktail = await this.cocktailRepository.findOne({
      where: { id: cocktailId, is_deleted: false },
    });
    if (cocktail) {
      return cocktail.rating ?? null;
    }

    // Try by parent_external_id (forked cocktail)
    const forked = await this.cocktailRepository.findOne({
      where: { parent_external_id: cocktailId, is_deleted: false },
    });
    if (forked) {
      return forked.rating ?? null;
    }

    // Calculate on-the-fly average from external_cocktail_ratings
    const cleanId = cocktailId.startsWith('ext-')
      ? cocktailId.slice(4)
      : cocktailId;
    const [ratings, count] = await this.externalRatingRepository.findAndCount({
      where: { external_cocktail_id: cleanId },
    });

    if (count === 0) return null;

    const avg = ratings
      .reduce((sum, r) => sum.plus(new Decimal(r.score)), new Decimal(0))
      .div(count)
      .toDecimalPlaces(2)
      .toNumber();

    return avg;
  }

  private async rateLocalCocktail(
    user: User,
    cocktail: Cocktail,
    score: number,
  ): Promise<{
    averageRating: number;
    userRating: number;
    ratingCount: number;
  }> {
    const existingRating = await this.ratingRepository.findOne({
      where: { user: { id: user.id }, cocktail: { id: cocktail.id } },
    });

    if (existingRating) {
      existingRating.score = score;
      await this.ratingRepository.save(existingRating);
    } else {
      const newRating = this.ratingRepository.create({
        user,
        cocktail,
        score,
      });
      await this.ratingRepository.save(newRating);
    }

    const [ratings, count] = await this.ratingRepository.findAndCount({
      where: { cocktail: { id: cocktail.id } },
    });

    const avg = ratings
      .reduce((sum, r) => sum.plus(new Decimal(r.score)), new Decimal(0))
      .div(count)
      .toDecimalPlaces(2)
      .toNumber();

    cocktail.rating = avg;
    cocktail.rating_count = count;
    await this.cocktailRepository.save(cocktail);

    return {
      averageRating: avg,
      userRating: score,
      ratingCount: count,
    };
  }

  private async rateExternalCocktail(
    user: User,
    externalId: string,
    score: number,
  ): Promise<{
    averageRating: number;
    userRating: number;
    ratingCount: number;
  }> {
    const existingRating = await this.externalRatingRepository.findOne({
      where: { user: { id: user.id }, external_cocktail_id: externalId },
    });

    if (existingRating) {
      existingRating.score = score;
      await this.externalRatingRepository.save(existingRating);
    } else {
      const newRating = this.externalRatingRepository.create({
        user,
        external_cocktail_id: externalId,
        score,
      });
      await this.externalRatingRepository.save(newRating);
    }

    // Calculate aggregate on-the-fly (no parent entity to cache on)
    const [ratings, count] = await this.externalRatingRepository.findAndCount({
      where: { external_cocktail_id: externalId },
    });

    const avg = ratings
      .reduce((sum, r) => sum.plus(new Decimal(r.score)), new Decimal(0))
      .div(count)
      .toDecimalPlaces(2)
      .toNumber();

    return {
      averageRating: avg,
      userRating: score,
      ratingCount: count,
    };
  }
}
