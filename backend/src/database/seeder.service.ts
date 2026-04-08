import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(User) 
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Automatically executes when the module initializes.
   * Ensures the mock user exists in the database for foreign key constraints.
   */
  async onModuleInit() {
    const mockEmail = 'mock@test.com';
    const exists = await this.userRepository.findOne({ where: { email: mockEmail } });
    
    if (!exists) {
      this.logger.log('Seeding mock user into the database...');
      const user = this.userRepository.create({
        id: '00000000-0000-0000-0000-000000000000',
        email: mockEmail,
        passwordHash: 'hashed_password_for_mock_user',
        displayName: 'Mock User',
        emailVerified: true,
      });
      await this.userRepository.save(user);
      this.logger.log('Mock user seeded successfully.');
    }
  }
}