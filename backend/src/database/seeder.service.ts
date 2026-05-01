import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(User) 
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      this.logger.log(`Skipping seeder in ${nodeEnv} mode`);
      return;
    }

    const mockEmail = 'mock@test.com';
    const exists = await this.userRepository.findOne({ where: { email: mockEmail } });
    
    if (!exists) {
      this.logger.log('Seeding mock user into the database...');
      const hashedPassword = await bcrypt.hash('mock_password_do_not_use_in_production', 10);
      const user = this.userRepository.create({
        id: uuidv4(),
        email: mockEmail,
        passwordHash: hashedPassword,
        displayName: 'Mock User',
        emailVerified: true,
        role: 'admin',
      });
      await this.userRepository.save(user);
      this.logger.log('Mock user seeded successfully.');
    }
  }
}