import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { PreparationLog } from '../cocktails/entities/preparation-log.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @InjectRepository(PreparationLog)
    private readonly preparationLogRepository: Repository<PreparationLog>,
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const newUser = this.userRepository.create(createUserDto);
    return await this.userRepository.save(newUser);
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;
    const [data, total] = await this.userRepository.findAndCount({
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
        totalPages,
      },
    };
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return await this.userRepository.save(user);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    return await this.userRepository.remove(user);
  }

  async getPreferences(userId: string) {
    let profile = await this.profileRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!profile) {
      const user = await this.findOne(userId);
      profile = this.profileRepository.create({
        user,
        unitSystem: 'metric',
        theme: 'system',
        defaultServings: 1,
        defaultPartSize: 30,
        showTutorial: true,
      });
      await this.profileRepository.save(profile);
    }
    return {
      unitSystem: profile.unitSystem,
      theme: profile.theme,
      defaultPartSize: profile.defaultPartSize,
      showTutorial: profile.showTutorial,
    };
  }

  async updatePreferences(
    userId: string,
    preferencesDto: Record<string, unknown>,
  ) {
    let profile = await this.profileRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!profile) {
      const user = await this.findOne(userId);
      profile = this.profileRepository.create({ user });
    }
    Object.assign(profile, {
      unitSystem: preferencesDto.unitSystem,
      theme: preferencesDto.theme,
      defaultPartSize: preferencesDto.defaultPartSize,
      showTutorial: preferencesDto.showTutorial,
    });
    await this.profileRepository.save(profile);
    return {
      unitSystem: profile.unitSystem,
      theme: profile.theme,
      defaultPartSize: profile.defaultPartSize,
      showTutorial: profile.showTutorial,
    };
  }

  async getAuthoredCocktails(
    userId: string,
    paginationQuery: PaginationQueryDto,
  ) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;

    const [data, total] = await this.cocktailRepository.findAndCount({
      where: { user: { id: userId }, is_deleted: false },
      skip: offset,
      take: limit,
      order: { created_at: 'DESC' },
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
        totalPages,
      },
    };
  }

  async getRecentPreparations(
    userId: string,
    paginationQuery: PaginationQueryDto,
  ) {
    const { limit = 10, page = 1 } = paginationQuery;
    const offset = (page - 1) * limit;

    const [data, total] = await this.preparationLogRepository.findAndCount({
      where: { bartender: { id: userId } },
      skip: offset,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;

    const limitTimeMs = 16 * 60 * 1000;
    const hydratedData = data.map((log) => {
      const duration = Date.now() - new Date(log.createdAt).getTime();
      return {
        id: log.id,
        cocktailId: log.cocktailId,
        externalCocktailId: log.externalCocktailId,
        cocktailName: log.cocktailNameSnapshot,
        servings: log.servings,
        deductedIngredients: log.deductedIngredients,
        createdAt: log.createdAt,
        undone: log.undone,
        canUndo:
          !log.undone && log.status === 'completed' && duration <= limitTimeMs,
      };
    });

    return {
      data: hydratedData,
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
      },
    };
  }
}
