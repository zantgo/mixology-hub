import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { RatingService } from './rating.service';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailRating } from './entities/cocktail-rating.entity';
import { ExternalCocktailRating } from './entities/external-cocktail-rating.entity';
import { User } from '../users/entities/user.entity';
import { CocktailDbService } from '../external/the-cocktail-db/cocktail-db.service';
import { CacheInvalidationService } from '../redis-cache/cache-invalidation.service';

describe('RatingService', () => {
  let service: RatingService;
  let cocktailRepo: any;
  let ratingRepo: any;
  let externalRatingRepo: any;
  let cocktailDbService: any;
  let cacheInvalidation: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
  } as unknown as User;

  const mockCocktail: Partial<Cocktail> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Cocktail',
    isDeleted: false,
    rating: null,
    ratingCount: 0,
  };

  beforeEach(async () => {
    cocktailRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    ratingRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    externalRatingRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    cocktailDbService = {
      getCocktailById: jest.fn(),
    };
    cacheInvalidation = {
      clearByPatterns: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingService,
        { provide: getRepositoryToken(Cocktail), useValue: cocktailRepo },
        { provide: getRepositoryToken(CocktailRating), useValue: ratingRepo },
        {
          provide: getRepositoryToken(ExternalCocktailRating),
          useValue: externalRatingRepo,
        },
        { provide: CocktailDbService, useValue: cocktailDbService },
        { provide: CacheInvalidationService, useValue: cacheInvalidation },
      ],
    }).compile();

    service = module.get<RatingService>(RatingService);
  });

  describe('rateCocktail', () => {
    const score = 4;

    describe('local cocktail rating', () => {
      it('should create a new rating and recalculate average for a local cocktail (UUID lookup)', async () => {
        cocktailRepo.findOne.mockResolvedValue(mockCocktail);
        ratingRepo.findOne.mockResolvedValue(null);
        ratingRepo.create.mockReturnValue({
          user: mockUser,
          cocktail: mockCocktail,
          score,
        });
        ratingRepo.save.mockResolvedValue({ id: 'rating-1', score });

        const mockRatings = [
          { score: new Decimal(4) },
          { score: new Decimal(5) },
        ];
        ratingRepo.findAndCount.mockResolvedValue([mockRatings, 2]);
        cocktailRepo.save.mockResolvedValue({
          ...mockCocktail,
          rating: 4.5,
          ratingCount: 2,
        });

        const result = await service.rateCocktail(mockUser, mockCocktail.id!, {
          score,
        });

        expect(result.userRating).toBe(score);
        expect(result.averageRating).toBe(4.5);
        expect(result.ratingCount).toBe(2);
        expect(cacheInvalidation.clearByPatterns).toHaveBeenCalledWith([
          'makeability:*',
          'search:*',
        ]);
      });

      it('should update an existing rating for a local cocktail', async () => {
        cocktailRepo.findOne.mockResolvedValue(mockCocktail);
        const existingRating = {
          id: 'rating-1',
          score: 3,
          user: mockUser,
          cocktail: mockCocktail,
        };
        ratingRepo.findOne.mockResolvedValue(existingRating);
        ratingRepo.save.mockResolvedValue({ ...existingRating, score });

        const mockRatings = [{ score: new Decimal(4) }];
        ratingRepo.findAndCount.mockResolvedValue([mockRatings, 1]);
        cocktailRepo.save.mockResolvedValue({
          ...mockCocktail,
          rating: 4,
          ratingCount: 1,
        });

        const result = await service.rateCocktail(mockUser, mockCocktail.id!, {
          score,
        });

        expect(ratingRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ score }),
        );
        expect(result.averageRating).toBe(4);
      });
    });

    describe('external-ID local cocktail rating (forked)', () => {
      it('should find a local fork by parentExternalId when UUID lookup fails', async () => {
        const forkId = 'ext-17141';
        const cleanId = '17141';
        const forkedCocktail = {
          ...mockCocktail,
          id: 'fork-uuid',
          parentExternalId: cleanId,
        };

        cocktailRepo.findOne.mockResolvedValue(forkedCocktail);

        ratingRepo.findOne.mockResolvedValue(null);
        ratingRepo.create.mockReturnValue({
          user: mockUser,
          cocktail: forkedCocktail,
          score,
        });
        ratingRepo.save.mockResolvedValue({ id: 'rating-1', score });
        ratingRepo.findAndCount.mockResolvedValue([
          [{ score: new Decimal(4) }],
          1,
        ]);
        cocktailRepo.save.mockResolvedValue({
          ...forkedCocktail,
          rating: 4,
          ratingCount: 1,
        });

        const result = await service.rateCocktail(mockUser, forkId, { score });

        expect(result.averageRating).toBe(4);
        expect(cocktailRepo.findOne).toHaveBeenCalledTimes(1);
      });
    });

    describe('external cocktail rating', () => {
      const externalId = 'ext-17141';
      const cleanId = '17141';

      it('should create a new external rating', async () => {
        cocktailRepo.findOne.mockResolvedValue(null); // no local cocktail
        cocktailDbService.getCocktailById.mockResolvedValue({
          idDrink: cleanId,
          strDrink: 'Mojito',
        });
        externalRatingRepo.findOne.mockResolvedValue(null);
        externalRatingRepo.create.mockReturnValue({
          user: mockUser,
          externalCocktailId: cleanId,
          score,
        });
        externalRatingRepo.save.mockResolvedValue({
          id: 'ext-rating-1',
          score,
        });
        externalRatingRepo.findAndCount.mockResolvedValue([
          [{ score: new Decimal(4) }],
          1,
        ]);

        const result = await service.rateCocktail(mockUser, externalId, {
          score,
        });

        expect(result.userRating).toBe(score);
        expect(result.averageRating).toBe(4);
        expect(result.ratingCount).toBe(1);
        expect(cacheInvalidation.clearByPatterns).toHaveBeenCalledWith([
          'makeability:*',
          'search:*',
        ]);
      });

      it('should update an existing external rating', async () => {
        cocktailRepo.findOne.mockResolvedValue(null);
        cocktailDbService.getCocktailById.mockResolvedValue({
          idDrink: cleanId,
          strDrink: 'Mojito',
        });
        const existingExtRating = {
          id: 'ext-rating-1',
          score: 3,
          user: mockUser,
          externalCocktailId: cleanId,
        };
        externalRatingRepo.findOne.mockResolvedValue(existingExtRating);
        externalRatingRepo.save.mockResolvedValue({
          ...existingExtRating,
          score,
        });
        externalRatingRepo.findAndCount.mockResolvedValue([
          [{ score: new Decimal(4) }, { score: new Decimal(5) }],
          2,
        ]);

        const result = await service.rateCocktail(mockUser, externalId, {
          score,
        });

        expect(externalRatingRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ score }),
        );
        expect(result.averageRating).toBe(4.5);
        expect(result.ratingCount).toBe(2);
      });

      it('should throw NotFoundException for non-existent external cocktail', async () => {
        cocktailRepo.findOne.mockResolvedValue(null);
        cocktailDbService.getCocktailById.mockResolvedValue(null);

        await expect(
          service.rateCocktail(mockUser, externalId, { score }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('getUserRating', () => {
    it('should return the rating score for a local cocktail', async () => {
      ratingRepo.findOne.mockResolvedValue({ score: 4 });

      const result = await service.getUserRating(mockUser, mockCocktail.id!);

      expect(result).toBe(4);
    });

    it('should return null when no local rating exists', async () => {
      ratingRepo.findOne.mockResolvedValue(null);

      const result = await service.getUserRating(mockUser, mockCocktail.id!);

      expect(result).toBeNull();
    });

    it('should find rating on a forked cocktail by parentExternalId', async () => {
      const forkId = 'ext-17141';
      const cleanId = '17141';

      ratingRepo.findOne
        .mockResolvedValueOnce(null) // first: direct UUID lookup
        .mockResolvedValueOnce(null); // second: fork rating lookup

      cocktailRepo.findOne.mockResolvedValue({
        ...mockCocktail,
        id: 'fork-uuid',
        parentExternalId: cleanId,
      });

      externalRatingRepo.findOne.mockResolvedValue(null);

      const result = await service.getUserRating(mockUser, forkId);

      expect(result).toBeNull();
    });

    it('should return external rating when no local rating exists', async () => {
      ratingRepo.findOne.mockResolvedValue(null);
      externalRatingRepo.findOne.mockResolvedValue({ score: 3 });

      const result = await service.getUserRating(
        mockUser,
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toBe(3);
    });
  });

  describe('getCocktailAverageRating', () => {
    it('should return cached rating for a local cocktail', async () => {
      cocktailRepo.findOne.mockResolvedValue({
        ...mockCocktail,
        rating: 4.2,
      });

      const result = await service.getCocktailAverageRating(mockCocktail.id!);

      expect(result).toBe(4.2);
    });

    it('should calculate average from external ratings when no local cocktail exists', async () => {
      cocktailRepo.findOne.mockResolvedValue(null);
      const externalRatings = [
        { score: new Decimal(3) },
        { score: new Decimal(5) },
        { score: new Decimal(4) },
      ];
      externalRatingRepo.findAndCount.mockResolvedValue([externalRatings, 3]);

      const result = await service.getCocktailAverageRating('ext-99999');

      expect(result).toBe(4);
    });

    it('should return null when no ratings exist at all', async () => {
      cocktailRepo.findOne.mockResolvedValue(null);
      externalRatingRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getCocktailAverageRating('ext-99999');

      expect(result).toBeNull();
    });

    it('should return null for a local cocktail without a cached rating', async () => {
      cocktailRepo.findOne.mockResolvedValue({
        ...mockCocktail,
        rating: null,
      });

      const result = await service.getCocktailAverageRating(mockCocktail.id!);

      expect(result).toBeNull();
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate caches after local rating creation', async () => {
      cocktailRepo.findOne.mockResolvedValue(mockCocktail);
      ratingRepo.findOne.mockResolvedValue(null);
      ratingRepo.create.mockReturnValue({
        user: mockUser,
        cocktail: mockCocktail,
        score: 5,
      });
      ratingRepo.save.mockResolvedValue({ id: 'rating-1', score: 5 });
      ratingRepo.findAndCount.mockResolvedValue([
        [{ score: new Decimal(5) }],
        1,
      ]);
      cocktailRepo.save.mockResolvedValue({
        ...mockCocktail,
        rating: 5,
        ratingCount: 1,
      });

      await service.rateCocktail(mockUser, mockCocktail.id!, { score: 5 });

      expect(cacheInvalidation.clearByPatterns).toHaveBeenCalledWith([
        'makeability:*',
        'search:*',
      ]);
    });

    it('should invalidate caches after local rating update', async () => {
      cocktailRepo.findOne.mockResolvedValue(mockCocktail);
      ratingRepo.findOne.mockResolvedValue({
        id: 'rating-1',
        score: 3,
        user: mockUser,
        cocktail: mockCocktail,
      });
      ratingRepo.save.mockResolvedValue({ id: 'rating-1', score: 5 });
      ratingRepo.findAndCount.mockResolvedValue([
        [{ score: new Decimal(5) }],
        1,
      ]);
      cocktailRepo.save.mockResolvedValue({
        ...mockCocktail,
        rating: 5,
        ratingCount: 1,
      });

      await service.rateCocktail(mockUser, mockCocktail.id!, { score: 5 });

      expect(cacheInvalidation.clearByPatterns).toHaveBeenCalledWith([
        'makeability:*',
        'search:*',
      ]);
    });

    it('should invalidate caches after external rating', async () => {
      cocktailRepo.findOne.mockResolvedValue(null);
      cocktailDbService.getCocktailById.mockResolvedValue({
        idDrink: '17141',
        strDrink: 'Mojito',
      });
      externalRatingRepo.findOne.mockResolvedValue(null);
      externalRatingRepo.create.mockReturnValue({
        user: mockUser,
        externalCocktailId: '17141',
        score: 4,
      });
      externalRatingRepo.save.mockResolvedValue({
        id: 'ext-rating-1',
        score: 4,
      });
      externalRatingRepo.findAndCount.mockResolvedValue([
        [{ score: new Decimal(4) }],
        1,
      ]);

      await service.rateCocktail(mockUser, 'ext-17141', { score: 4 });

      expect(cacheInvalidation.clearByPatterns).toHaveBeenCalledWith([
        'makeability:*',
        'search:*',
      ]);
    });
  });
});
