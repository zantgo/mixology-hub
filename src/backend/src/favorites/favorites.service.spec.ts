import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { HiddenExternalCocktail } from '../cocktails/entities/hidden-external-cocktail.entity';
import { CocktailAggregatorService } from '../cocktails/cocktail-aggregator.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favoriteRepo: any;
  let userRepo: any;
  let cocktailRepo: any;
  let hiddenRepo: any;
  let aggregatorService: any;

  const mockUser = { id: 'user-1', email: 'test@example.com' };
  const mockCocktail = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Cocktail',
    isDeleted: false,
  };

  beforeEach(async () => {
    favoriteRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    userRepo = { findOne: jest.fn() };
    cocktailRepo = { findOne: jest.fn() };
    hiddenRepo = { find: jest.fn().mockResolvedValue([]) };
    aggregatorService = { getExternalCocktailById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useValue: favoriteRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Cocktail), useValue: cocktailRepo },
        {
          provide: getRepositoryToken(HiddenExternalCocktail),
          useValue: hiddenRepo,
        },
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
        cocktail: { id: '123e4567-e89b-12d3-a456-426614174000' },
        user: mockUser,
      });
      favoriteRepo.save.mockResolvedValue({
        id: 'fav-1',
        cocktail: { id: '123e4567-e89b-12d3-a456-426614174000' },
      });

      const result = await service.create('user-1', {
        cocktailId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result).toBeDefined();
      expect(favoriteRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          cocktailId: '123e4567-e89b-12d3-a456-426614174000',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent cocktail', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      cocktailRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          cocktailId: '123e4567-e89b-12d3-a456-426614174000',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create external cocktail favorite', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      favoriteRepo.create.mockReturnValue({ externalCocktailId: '123' });
      favoriteRepo.save.mockResolvedValue({
        id: 'fav-2',
        externalCocktailId: '123',
      });

      const result = await service.create('user-1', {
        externalCocktailId: '123',
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
          cocktailId: '123e4567-e89b-12d3-a456-426614174000',
          externalCocktailId: null,
          cocktail: mockCocktail,
        },
        {
          id: 'fav-2',
          cocktailId: null,
          externalCocktailId: '11111',
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

  describe('countFavorites', () => {
    it('should return the count of favorites for a cocktail', async () => {
      favoriteRepo.count.mockResolvedValue(5);

      const result = await service.countFavorites(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toBe(5);
      expect(favoriteRepo.count).toHaveBeenCalledWith({
        where: { cocktail: { id: '123e4567-e89b-12d3-a456-426614174000' } },
      });
    });

    it('should return 0 when no favorites exist', async () => {
      favoriteRepo.count.mockResolvedValue(0);

      const result = await service.countFavorites(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toBe(0);
    });
  });
});
