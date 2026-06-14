import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { SystemSetting } from '../users/entities/system-setting.entity';
import { Decimal } from 'decimal.js';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface SeedIngredient {
  name: string;
  baseUnit: string;
  density: number;
  allowMassVolumeConversion: boolean;
  synonyms: string;
}

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(SystemSetting)
    private readonly settingsRepository: Repository<SystemSetting>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      this.logger.log(`Skipping seeder in ${nodeEnv} mode`);
      return;
    }

    await this.seedMockUser();
    await this.seedIngredients();
    await this.seedSystemSettings();
  }

  private async seedMockUser(): Promise<void> {
    const mockEmail = 'mock@test.com';
    const exists = await this.userRepository.findOne({
      where: { email: mockEmail },
    });

    if (!exists) {
      this.logger.log('Seeding mock user and default profile...');
      const hashedPassword = await bcrypt.hash(
        'mock_password_do_not_use_in_production',
        10,
      );

      await this.userRepository.manager.transaction(
        async (transactionalEntityManager) => {
          const user = this.userRepository.create({
            id: uuidv4(),
            email: mockEmail,
            passwordHash: hashedPassword,
            displayName: 'Mock User',
            emailVerified: true,
            role: 'admin',
          });
          const savedUser = await transactionalEntityManager.save(user);

          const profile = transactionalEntityManager.create(UserProfile, {
            user: savedUser,
            unitSystem: 'metric',
            theme: 'system',
            defaultServings: 1,
            defaultPartSize: 30,
            showTutorial: true,
          });
          await transactionalEntityManager.save(profile);
        },
      );

      this.logger.log('Mock user and profile seeded successfully.');
    }
  }

  private async seedIngredients(): Promise<void> {
    const count = await this.ingredientRepository.count({
      where: { isGlobal: true },
    });
    if (count > 0) {
      this.logger.log(
        `Ingredients already seeded (${count} global ingredients found), skipping.`,
      );
      return;
    }

    const seedPath = path.join(__dirname, 'seeds', 'ingredients-seed.json');
    let ingredients: SeedIngredient[];

    try {
      const raw = fs.readFileSync(seedPath, 'utf-8');
      ingredients = JSON.parse(raw);
    } catch (err: any) {
      this.logger.error(`Failed to load ingredients seed file: ${err.message}`);
      return;
    }

    this.logger.log(`Seeding ${ingredients.length} global ingredients...`);

    const entities = ingredients.map((ing) =>
      this.ingredientRepository.create({
        id: uuidv4(),
        name: ing.name,
        baseUnit: ing.baseUnit,
        density: new Decimal(ing.density),
        allowMassVolumeConversion: ing.allowMassVolumeConversion,
        synonyms: ing.synonyms,
        isGlobal: true,
        createdBy: null,
        hierarchyLevel: 0,
      }),
    );

    await this.ingredientRepository.save(entities);
    this.logger.log(
      `Seeded ${entities.length} global ingredients successfully.`,
    );
  }

  private async seedSystemSettings(): Promise<void> {
    const KEY = 'global_token_salt_version';
    const exists = await this.settingsRepository.findOne({
      where: { settingKey: KEY },
    });

    if (!exists) {
      this.logger.log('Seeding global token salt version setting...');
      const setting = this.settingsRepository.create({
        settingKey: KEY,
        settingValue: '0',
        updatedBy: null,
      });
      await this.settingsRepository.save(setting);
      this.logger.log('System settings seeded successfully.');
    }
  }
}
