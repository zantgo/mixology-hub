import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const newUser = this.userRepository.create(createUserDto);
    return await this.userRepository.save(newUser);
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { limit = 10, offset = 0 } = paginationQuery;
    const [data, total] = await this.userRepository.findAndCount({
      skip: offset,
      take: limit,
    });
    return { data, total, limit, offset };
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

  // Returns the seeded mock user (Simulating Auth Context)
  async getMockUser(): Promise<User> {
    const user = await this.userRepository.findOne({ where: { email: 'mock@test.com' } });
    if (!user) throw new NotFoundException('Mock user not found. Ensure seeder has run.');
    return user;
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    return await this.userRepository.remove(user);
  }
}
