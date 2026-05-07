import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailAggregatorService } from '../cocktails/cocktail-aggregator.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favoriteRepo: any;
  let userRepo: any;
  let cocktailRepo: any;
  let aggregatorService: any;

  const mockUser = { id: 'user-1', email: 'test@example.com' };
  const mockCocktail = {
    id: 'cock-1',
    name: 'Test Cocktail',
    is_deleted: false,
  };

  beforeEach(async () => {
    favoriteRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    userRepo = { findOne: jest.fn() };
    cocktailRepo = { findOne: jest.fn() };
    aggregatorService = { getExternalCocktailById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useValue: favoriteRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Cocktail), useValue: cocktailRepo },
        { provide: CocktailAggregatorService, useValue: aggregatorService },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  describe('create', () => {
    it('should create a local cocktail favorite', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      cocktailRepo.findOne.mockResolvedValue(mockCocktail);
      favoriteRepo.create.mockReturnValue({
        cocktail: { id: 'cock-1' },
        user: mockUser,
      });
      favoriteRepo.save.mockResolvedValue({
        id: 'fav-1',
        cocktail: { id: 'cock-1' },
      });

      const result = await service.create('user-1', { cocktailId: 'cock-1' });

      expect(result).toBeDefined();
      expect(favoriteRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('user-1', { cocktailId: 'cock-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent cocktail', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      cocktailRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('user-1', { cocktailId: 'cock-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create external cocktail favorite', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      favoriteRepo.create.mockReturnValue({ external_cocktail_id: 'ext-123' });
      favoriteRepo.save.mockResolvedValue({
        id: 'fav-2',
        external_cocktail_id: 'ext-123',
      });

      const result = await service.create('user-1', {
        externalCocktailId: 'ext-123',
      });

      expect(result).toBeDefined();
      expect(cocktailRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated favorites with hydration', async () => {
      const mockFavorites = [
        {
          id: 'fav-1',
          cocktailId: 'cock-1',
          external_cocktail_id: null,
          cocktail: mockCocktail,
        },
        {
          id: 'fav-2',
          cocktailId: null,
          external_cocktail_id: '11111',
          cocktail: null,
        },
      ];

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockFavorites, 2]),
      };
      favoriteRepo.createQueryBuilder.mockReturnValue(mockQb);
      aggregatorService.getExternalCocktailById.mockResolvedValue({
        name: 'External Drink',
        ingredients: [],
      });

      const result = await service.findAll('user-1', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);
    });
  });

  describe('remove', () => {
    it('should remove an existing favorite', async () => {
      const mockFav = { id: 'fav-1', user: mockUser, cocktail: mockCocktail };
      favoriteRepo.findOne.mockResolvedValue(mockFav);
      favoriteRepo.remove.mockResolvedValue(mockFav);

      await service.remove('user-1', 'fav-1');

      expect(favoriteRepo.remove).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent favorite', async () => {
      favoriteRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
