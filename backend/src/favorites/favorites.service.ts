import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favoriteRepository: Repository<Favorite>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateFavoriteDto) {
    const user = await this.userRepository.findOne({ where: { email: 'mock@test.com' } });
    if (!user) throw new NotFoundException('User not found');

    const favorite = this.favoriteRepository.create({
      user: user,
      cocktail: dto.cocktailId ? { id: dto.cocktailId } : undefined, // <--- FIX (undefined)
      external_cocktail_id: dto.externalCocktailId || undefined,     // <--- FIX (undefined)
   });

    return await this.favoriteRepository.save(favorite);
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const user = await this.userRepository.findOne({ where: { email: 'mock@test.com' } });
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;

    const [data, total] = await this.favoriteRepository.findAndCount({
      where: { user: { id: user?.id } },
      relations: ['cocktail'],
      skip: offset,
      take: limit,
    });
    
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    
    return { 
      data, 
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: total,
        totalPages
      }
    };
  }

  async findOne(id: string) {
    const favorite = await this.favoriteRepository.findOne({ 
      where: { id },
      relations:['user', 'cocktail'] 
    });
    
    if (!favorite) {
      throw new NotFoundException(`Favorite with ID ${id} not found`);
    }
    
    return favorite;
  }

  async update(id: string, updateFavoriteDto: UpdateFavoriteDto) {
    const favorite = await this.findOne(id);

    if (updateFavoriteDto.cocktailId !== undefined) {
      favorite.cocktail = updateFavoriteDto.cocktailId ? { id: updateFavoriteDto.cocktailId } as any : null;
    }
    
    if (updateFavoriteDto.externalCocktailId !== undefined) {
      favorite.external_cocktail_id = updateFavoriteDto.externalCocktailId || null;
    }

    return await this.favoriteRepository.save(favorite);
  }

  async remove(id: string) {
    const favorite = await this.findOne(id); 
    return await this.favoriteRepository.remove(favorite);
  }
}
