import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SeederService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    const mockEmail = 'mock@test.com';
    const exists = await this.userRepository.findOne({ where: { email: mockEmail } });
    if (!exists) {
      console.log('Seeding mock user...');
      const user = this.userRepository.create({
        id: '00000000-0000-0000-0000-000000000000',
        email: mockEmail,
        password_hash: 'hash',
      });
      await this.userRepository.save(user);
    }
  }
}
