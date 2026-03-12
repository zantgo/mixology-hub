import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { Favorite } from './entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
  ) {}

  async create(createFavoriteDto: CreateFavoriteDto) {
    const favorite = this.favoriteRepository.create(createFavoriteDto);
    return await this.favoriteRepository.save(favorite);
  }

  async findAll() {
    return await this.favoriteRepository.find({ relations: ['user', 'cocktail'] });
  }

  async findOne(id: string) {
    const favorite = await this.favoriteRepository.findOne({ 
      where: { id },
      relations: ['user', 'cocktail'] 
    });
    if (!favorite) throw new NotFoundException(`Favorite with ID ${id} not found`);
    return favorite;
  }

  async update(id: string, updateFavoriteDto: UpdateFavoriteDto) {
    const favorite = await this.findOne(id);
    Object.assign(favorite, updateFavoriteDto);
    return await this.favoriteRepository.save(favorite);
  }

  async remove(id: string) {
    const favorite = await this.findOne(id);
    return await this.favoriteRepository.remove(favorite);
  }
}
