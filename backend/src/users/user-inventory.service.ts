import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserInventory } from './entities/user-inventory.entity';
import { AddInventoryDto } from './dto/add-inventory.dto';
import { UsersService } from './users.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { UnitConverterService } from '../utils/unit-converter.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class UserInventoryService {
  constructor(
    @InjectRepository(UserInventory)
    private readonly inventoryRepository: Repository<UserInventory>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    private readonly usersService: UsersService,
    private readonly unitConverter: UnitConverterService,
  ) {}

  async addToInventory(dto: AddInventoryDto) {
    const user = await this.usersService.getMockUser();

    const ingredient = await this.ingredientRepository.findOne({ where: { id: dto.ingredientId } });
    if (!ingredient) throw new NotFoundException('Ingredient not found');

    let inventoryItem = await this.inventoryRepository.findOne({
      where: { user: { id: user.id }, ingredient: { id: ingredient.id } }
    });

    if (inventoryItem) {
      inventoryItem.quantity = Number(inventoryItem.quantity) + dto.quantity;
      inventoryItem.unit = dto.unit;
      return await this.inventoryRepository.save(inventoryItem);
    } else {
      try {
        inventoryItem = this.inventoryRepository.create({
          user,
          ingredient,
          quantity: dto.quantity,
          unit: dto.unit
        });
        return await this.inventoryRepository.save(inventoryItem);
      } catch (error: any) {
        if (error.code === '23505') {
          const existing = await this.inventoryRepository.findOne({
            where: { user: { id: user.id }, ingredient: { id: ingredient.id } }
          });
          if (existing) {
            existing.quantity = Number(existing.quantity) + dto.quantity;
            existing.unit = dto.unit;
            return await this.inventoryRepository.save(existing);
          }
        }
        throw error;
      }
    }
  }

  async getUserInventory(paginationQuery: PaginationQueryDto) {
    const user = await this.usersService.getMockUser();
    const { limit = 10, offset = 0 } = paginationQuery;

    const[data, total] = await this.inventoryRepository.findAndCount({
      where: { user: { id: user.id } },
      relations: ['ingredient'],
      skip: offset,
      take: limit,
    });

    return { data, total, limit, offset };
  }

  async remove(id: string) {
    const item = await this.inventoryRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return await this.inventoryRepository.remove(item);
  }

  async getMakeableCocktails(paginationQuery: PaginationQueryDto) {
    const user = await this.usersService.getMockUser();
    const { limit = 10, offset = 0 } = paginationQuery;
    
    // 1. Obtener inventario del usuario para realizar la validación matemática final
    const inventory = await this.inventoryRepository.find({
      where: { user: { id: user.id } },
      relations: ['ingredient']
    });

    // 2. Usar QueryBuilder para obtener solo cócteles que contengan los ingredientes del inventario
    // Filtramos en la DB aquellos cócteles donde todos sus ingredientes requeridos están en el inventario del usuario
    const inventoryIngredientIds = inventory.map(i => i.ingredient.id);

    if (inventoryIngredientIds.length === 0) {
      return { data: [], total: 0, limit, offset };
    }

    const queryBuilder = this.cocktailRepository.createQueryBuilder('cocktail')
      .innerJoin('cocktail.ingredients', 'ci')
      .innerJoin('ci.ingredient', 'i')
      .groupBy('cocktail.id')
      // Filtramos cócteles cuyos ingredientes requeridos estén todos en el inventario
      .having('COUNT(DISTINCT i.id) = (SELECT COUNT(*) FROM cocktail_ingredients ci2 WHERE ci2.cocktail_id = cocktail.id)')
      .andWhere('i.id IN (:...ids)', { ids: inventoryIngredientIds });

    const allPotentiallyMakeable = await queryBuilder.getMany();

    // 3. Aplicar validación de cantidad usando UnitConverterService
    const makeableCocktails = allPotentiallyMakeable.filter(cocktail => {
      return cocktail.ingredients.every(req => {
        const stock = inventory.find(i => i.ingredient.id === req.ingredient.id);
        return stock && this.unitConverter.hasEnoughStock(
          Number(stock.quantity), stock.unit, req.amount, req.unit
        );
      });
    });

    // 4. Paginación final
    const paginatedData = makeableCocktails.slice(offset, offset + limit);

    return {
      data: paginatedData,
      total: makeableCocktails.length,
      limit,
      offset,
    };
  }
}
