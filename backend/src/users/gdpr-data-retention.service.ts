import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from './entities/user.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { UserProfile } from './entities/user-profile.entity';
import { Ai } from '../ai/entities/ai.entity';
import { UserAiQuotas } from '../ai/entities/user-ai-quotas.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { TokenBlacklist } from '../auth/entities/token-blacklist.entity';
import { ConfigService } from '@nestjs/config';

export interface DataRetentionPolicy {
  // User data retention (in days)
  userInactiveThreshold: number; // Delete users inactive for X days
  userAnonymizeThreshold: number; // Anonymize users inactive for Y days (Y < X)
  
  // Inventory data retention (in days)
  inventoryHistoryThreshold: number; // Delete inventory history older than X days
  
  // AI generated data retention (in days)
  aiGeneratedDataThreshold: number; // Delete AI generated recipes older than X days
  
  // Log data retention (in days)
  logDataThreshold: number; // Delete logs older than X days
}

@Injectable()
export class GdprDataRetentionService {
  private readonly logger = new Logger(GdprDataRetentionService.name);
  private readonly policy: DataRetentionPolicy;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BarInventory)
    private readonly inventoryRepository: Repository<BarInventory>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @InjectRepository(Ai)
    private readonly aiRepository: Repository<Ai>,
    @InjectRepository(UserAiQuotas)
    private readonly quotaRepository: Repository<UserAiQuotas>,
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepository: Repository<TokenBlacklist>,
    private readonly configService: ConfigService,
  ) {
    // Load retention policy from config or use defaults
    this.policy = {
      userInactiveThreshold: parseInt(this.configService.get<string>('GDPR_USER_INACTIVE_THRESHOLD') || '730'), // 2 years
      userAnonymizeThreshold: parseInt(this.configService.get<string>('GDPR_USER_ANONYMIZE_THRESHOLD') || '365'), // 1 year
      inventoryHistoryThreshold: parseInt(this.configService.get<string>('GDPR_INVENTORY_THRESHOLD') || '180'), // 6 months
      aiGeneratedDataThreshold: parseInt(this.configService.get<string>('GDPR_AI_DATA_THRESHOLD') || '90'), // 3 months
      logDataThreshold: parseInt(this.configService.get<string>('GDPR_LOG_THRESHOLD') || '30'), // 1 month
    };
  }

  /**
   * Scheduled job to run data retention cleanup
   * Runs daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDataRetentionCleanup(): Promise<void> {
    this.logger.log('Starting GDPR data retention cleanup');
    
    try {
      const results = {
        anonymizedUsers: 0,
        deletedUsers: 0,
        deletedInventory: 0,
        deletedAiData: 0,
        errors: [] as string[],
      };

      // 1. Anonymize inactive users
      results.anonymizedUsers = await this.anonymizeInactiveUsers();
      
      // 2. Delete permanently inactive users
      results.deletedUsers = await this.deleteInactiveUsers();
      
      // 3. Clean up old inventory data
      results.deletedInventory = await this.cleanupOldInventoryData();
      
      // 4. Clean up old AI generated data
      results.deletedAiData = await this.cleanupOldAiData();

      // 5. Clean up expired token blacklist entries
      const deletedTokens = await this.cleanupExpiredTokens();
      this.logger.log(`Cleaned up ${deletedTokens} expired tokens`);

      this.logger.log(`GDPR cleanup completed: ${JSON.stringify(results)}`);
      
    } catch (error) {
      this.logger.error('GDPR data retention cleanup failed', error.stack);
    }
  }

  /**
   * Anonymize users who have been inactive for a certain period
   */
  async anonymizeInactiveUsers(): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - this.policy.userAnonymizeThreshold);

    const usersToAnonymize = await this.userRepository.find({
      where: {
        lastLoginAt: LessThan(thresholdDate),
        is_anonymized: false,
      },
      take: 100, // Batch size for safety
    });

    let anonymizedCount = 0;
    
    for (const user of usersToAnonymize) {
      try {
        await this.anonymizeUser(user);
        anonymizedCount++;
      } catch (error) {
        this.logger.error(`Failed to anonymize user ${user.id}`, error.message);
      }
    }

    this.logger.log(`Anonymized ${anonymizedCount} inactive users`);
    return anonymizedCount;
  }

  /**
   * Delete users who have been inactive for a longer period (after anonymization)
   */
  async deleteInactiveUsers(): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - this.policy.userInactiveThreshold);

    const usersToDelete = await this.userRepository.find({
      where: {
        lastLoginAt: LessThan(thresholdDate),
        is_anonymized: true,
      },
      take: 50, // Smaller batch for deletion
    });

    let deletedCount = 0;
    
    for (const user of usersToDelete) {
      try {
        // First, delete all associated data
        await this.deleteUserData(user.id);
        
        // Then delete the user
        await this.userRepository.delete(user.id);
        deletedCount++;
      } catch (error) {
        this.logger.error(`Failed to delete user ${user.id}`, error.message);
      }
    }

    this.logger.log(`Deleted ${deletedCount} inactive users`);
    return deletedCount;
  }

  /**
   * Clean up old inventory data
   */
  async cleanupOldInventoryData(): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - this.policy.inventoryHistoryThreshold);

    // Delete inventory items that haven't been updated in a long time
    const result = await this.inventoryRepository
      .createQueryBuilder('inventory')
      .delete()
      .where('updated_at < :threshold', { threshold: thresholdDate })
      .andWhere('quantity = 0') // Only delete empty inventory items
      .execute();

    this.logger.log(`Deleted ${result.affected || 0} old inventory items`);
    return result.affected || 0;
  }

  /**
   * Clean up old AI generated data
   */
  async cleanupOldAiData(): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - this.policy.aiGeneratedDataThreshold);

    // Delete AI generated recipes that are old and not saved as cocktails
    const result = await this.aiRepository
      .createQueryBuilder('ai')
      .delete()
      .where('created_at < :threshold', { threshold: thresholdDate })
      .andWhere('saved_as_cocktail_id IS NULL') // Only delete unsaved AI recipes
      .execute();

    this.logger.log(`Deleted ${result.affected || 0} old AI generated recipes`);
    return result.affected || 0;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.tokenBlacklistRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < NOW()')
      .execute();

    this.logger.log(`Cleaned up ${result.affected || 0} expired token blacklist entries`);
    return result.affected || 0;
  }

  /**
   * Anonymize a user's personal data
   */
  private async anonymizeUser(user: User): Promise<void> {
    // Generate anonymous identifier
    const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Anonymize personal data
    user.email = `${anonymousId}@anonymized.mixologyhub`;
    user.username = `user_${anonymousId}`;
    user.first_name = 'Anonymous';
    user.last_name = 'User';
    user.profile_picture_url = null;
    user.bio = null;
    user.date_of_birth = null;
    user.is_anonymized = true;
    user.anonymized_at = new Date();

    await this.userRepository.save(user);
    
    this.logger.log(`Anonymized user ${user.id} -> ${anonymousId}`);
  }

  /**
   * Delete all data associated with a user
   */
  private async deleteUserData(userId: string): Promise<void> {
    // Delete user-created cocktails first (hard delete via repository to respect cascade)
    const userCocktails = await this.cocktailRepository.find({
      where: { user: { id: userId } },
      relations: ['ingredients'],
    });
    for (const cocktail of userCocktails) {
      await this.cocktailRepository.remove(cocktail);
    }

    // Note: BarInventory is NOT deleted — it belongs to the bar, not the individual user

    // Delete user profile
    await this.profileRepository.delete({ user: { id: userId } });

    // Delete favorites
    await this.favoriteRepository.delete({ user: { id: userId } });

    // Delete AI generated recipes
    await this.aiRepository.delete({ user: { id: userId } });

    // Delete AI quotas
    await this.quotaRepository.delete({ user: { id: userId } });

    this.logger.log(`Deleted all data for user ${userId}`);
  }

  /**
   * Export user data for GDPR right to access
   */
  async exportUserData(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const inventory = await this.inventoryRepository.find({
      relations: ['ingredient'],
    });

    const aiRecipes = await this.aiRepository.find({
      where: { user: { id: userId } },
    });

    const exportData = {
      userProfile: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.createdAt,
        lastLogin: user.lastLoginAt,
        isAnonymized: user.is_anonymized,
      },
      inventory: inventory.map(item => ({
        ingredientId: item.ingredient.id,
        ingredientName: item.ingredient.name,
        quantity: item.quantity,
        unit: item.ingredient.baseUnit,
      })),
      aiGeneratedRecipes: aiRecipes.map(recipe => ({
        id: recipe.id,
        prompt: recipe.prompt,
        generatedAt: recipe.created_at,
        savedAsCocktail: recipe.saved_as_cocktail_id,
        validationScore: recipe.validation_score,
      })),
      exportDate: new Date().toISOString(),
    };

    return exportData;
  }

  /**
   * Delete user account and all associated data (GDPR right to be forgotten)
   */
  async deleteUserAccount(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    try {
      // Delete all user data
      await this.deleteUserData(userId);
      
      // Delete the user account
      await this.userRepository.delete(userId);
      
      this.logger.log(`Deleted user account ${userId} (GDPR right to be forgotten)`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete user account ${userId}`, error.message);
      return false;
    }
  }

  /**
   * Get data retention statistics
   */
  async getRetentionStats(): Promise<any> {
    const now = new Date();
    
    // Calculate threshold dates
    const userAnonymizeThreshold = new Date(now);
    userAnonymizeThreshold.setDate(userAnonymizeThreshold.getDate() - this.policy.userAnonymizeThreshold);
    
    const userDeleteThreshold = new Date(now);
    userDeleteThreshold.setDate(userDeleteThreshold.getDate() - this.policy.userInactiveThreshold);
    
    const inventoryThreshold = new Date(now);
    inventoryThreshold.setDate(inventoryThreshold.getDate() - this.policy.inventoryHistoryThreshold);
    
    const aiDataThreshold = new Date(now);
    aiDataThreshold.setDate(aiDataThreshold.getDate() - this.policy.aiGeneratedDataThreshold);

    // Count records that would be affected
      const [
      usersToAnonymize,
      usersToDelete,
      inventoryToCleanup,
      aiDataToCleanup,
      totalUsers,
      totalInventory,
      totalAiData,
    ] = await Promise.all([
      this.userRepository.count({
        where: {
          lastLoginAt: LessThan(userAnonymizeThreshold),
          is_anonymized: false,
        },
      }),
      this.userRepository.count({
        where: {
          lastLoginAt: LessThan(userDeleteThreshold),
          is_anonymized: true,
        },
      }),
      this.inventoryRepository
        .createQueryBuilder('inventory')
        .where('updated_at < :threshold', { threshold: inventoryThreshold })
        .andWhere('quantity = 0')
        .getCount(),
      this.aiRepository
        .createQueryBuilder('ai')
        .where('created_at < :threshold', { threshold: aiDataThreshold })
        .andWhere('saved_as_cocktail_id IS NULL')
        .getCount(),
      this.userRepository.count(),
      this.inventoryRepository.count(),
      this.aiRepository.count(),
    ]);

    return {
      policy: this.policy,
      nextCleanup: {
        usersToAnonymize,
        usersToDelete,
        inventoryToCleanup,
        aiDataToCleanup,
      },
      totals: {
        users: totalUsers,
        inventory: totalInventory,
        aiData: totalAiData,
      },
      lastRun: new Date().toISOString(),
    };
  }
}