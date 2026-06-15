import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, EntityManager } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from './entities/user.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { AiGeneratedRecipe } from '../ai/entities/ai.entity';
import { UserAiQuota } from '../ai/entities/user-ai-quota.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailRating } from '../cocktails/entities/cocktail-rating.entity';
import { PreparationLog } from '../cocktails/entities/preparation-log.entity';
import { TokenBlacklist } from '../auth/entities/token-blacklist.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

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
    @InjectRepository(AiGeneratedRecipe)
    private readonly aiRepository: Repository<AiGeneratedRecipe>,
    @InjectRepository(UserAiQuota)
    private readonly quotaRepository: Repository<UserAiQuota>,
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    @InjectRepository(Cocktail)
    private readonly cocktailRepository: Repository<Cocktail>,
    @InjectRepository(CocktailRating)
    private readonly cocktailRatingRepository: Repository<CocktailRating>,
    @InjectRepository(PreparationLog)
    private readonly preparationLogRepository: Repository<PreparationLog>,
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepository: Repository<TokenBlacklist>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly configService: ConfigService,
  ) {
    // Load retention policy from config or use defaults
    this.policy = {
      userInactiveThreshold: parseInt(
        this.configService.get<string>('GDPR_USER_INACTIVE_THRESHOLD') || '730',
      ), // 2 years
      userAnonymizeThreshold: parseInt(
        this.configService.get<string>('GDPR_USER_ANONYMIZE_THRESHOLD') ||
          '365',
      ), // 1 year
      inventoryHistoryThreshold: parseInt(
        this.configService.get<string>('GDPR_INVENTORY_THRESHOLD') || '180',
      ), // 6 months
      aiGeneratedDataThreshold: parseInt(
        this.configService.get<string>('GDPR_AI_DATA_THRESHOLD') || '90',
      ), // 3 months
      logDataThreshold: parseInt(
        this.configService.get<string>('GDPR_LOG_THRESHOLD') || '30',
      ), // 1 month
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
      this.logger.error(
        'GDPR data retention cleanup failed',
        (error as Error).stack,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanOldPreparationLogs(): Promise<void> {
    const now = new Date();

    // Standard completed/failed logs: delete if older than 30 days and not undone
    const standardThreshold = new Date(now);
    standardThreshold.setDate(standardThreshold.getDate() - 30);

    // Undone logs: retain for 90 days for administrative auditing
    const undoneThreshold = new Date(now);
    undoneThreshold.setDate(undoneThreshold.getDate() - 90);

    // Transactional deletion for standard logs
    const standardResult = await this.preparationLogRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :threshold', { threshold: standardThreshold })
      .andWhere('undone = :undone', { undone: false })
      .andWhere('status != :status', { status: 'queued' })
      .execute();

    // Transactional deletion for undone logs (retained up to 90 days)
    const undoneResult = await this.preparationLogRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :threshold', { threshold: undoneThreshold })
      .andWhere('undone = :undone', { undone: true })
      .execute();

    this.logger.log(
      `Cleaned up ${standardResult.affected || 0} standard logs (>30 days) and ${undoneResult.affected || 0} undone logs (>90 days)`,
    );
  }

  /**
   * Anonymize users who have been inactive for a certain period
   */
  async anonymizeInactiveUsers(): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setDate(
      thresholdDate.getDate() - this.policy.userAnonymizeThreshold,
    );

    const usersToAnonymize = await this.userRepository.find({
      where: {
        lastLoginAt: LessThan(thresholdDate),
        isAnonymized: false,
      },
      take: 50,
    });

    if (usersToAnonymize.length === 0) return 0;

    return this.userRepository.manager.transaction(async (tx) => {
      let anonymizedCount = 0;
      for (const user of usersToAnonymize) {
        try {
          await this.anonymizeUser(user, tx);
          anonymizedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to anonymize user ${user.id}`,
            (error as Error).message,
          );
        }
      }
      this.logger.log(`Anonymized ${anonymizedCount} inactive users`);
      return anonymizedCount;
    });
  }

  /**
   * Delete users who have been inactive for a longer period (after anonymization)
   */
  async deleteInactiveUsers(): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setDate(
      thresholdDate.getDate() - this.policy.userInactiveThreshold,
    );

    const usersToDelete = await this.userRepository.find({
      where: {
        lastLoginAt: LessThan(thresholdDate),
        isAnonymized: true,
      },
      take: 10,
    });

    if (usersToDelete.length === 0) return 0;

    let deletedCount = 0;
    for (const user of usersToDelete) {
      try {
        await this.deleteUserData(user.id);
        await this.userRepository.delete(user.id);
        deletedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to delete user ${user.id}`,
          (error as Error).message,
        );
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
    thresholdDate.setDate(
      thresholdDate.getDate() - this.policy.inventoryHistoryThreshold,
    );

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
    thresholdDate.setDate(
      thresholdDate.getDate() - this.policy.aiGeneratedDataThreshold,
    );

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

    this.logger.log(
      `Cleaned up ${result.affected || 0} expired token blacklist entries`,
    );
    return result.affected || 0;
  }

  /**
   * Anonymize a user's personal data
   */
  private async anonymizeUser(
    user: User,
    manager?: EntityManager,
  ): Promise<void> {
    const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    user.email = `${anonymousId}@anonymized.mixologyhub`;
    user.username = `user_${anonymousId}`;
    user.firstName = 'Anonymous';
    user.lastName = 'User';
    user.profilePictureUrl = null;
    user.bio = null;
    user.dateOfBirth = null;
    user.isAnonymized = true;
    user.anonymizedAt = new Date();

    if (manager) {
      await manager.save(user);
    } else {
      await this.userRepository.save(user);
    }

    this.logger.log(`Anonymized user ${user.id} -> ${anonymousId}`);
  }

  /**
   * Delete all data associated with a user
   */
  private async deleteUserData(userId: string): Promise<void> {
    // Delete user-created cocktails: anonymize public, hard-delete private
    const userCocktails = await this.cocktailRepository.find({
      where: { user: { id: userId } },
      relations: ['ingredients'],
    });
    for (const cocktail of userCocktails) {
      if (cocktail.isPublic) {
        cocktail.user = null;
        await this.cocktailRepository.save(cocktail);
      } else {
        if (cocktail.imageFull || cocktail.imageThumb) {
          await this.unlinkCocktailImages(cocktail);
        }
        await this.cocktailRepository.remove(cocktail);
      }
    }

    // Note: BarInventory is NOT deleted — it belongs to the bar, not the individual user

    // Batch parallel: anonymize ingredients, delete favorites, AI data, quotas, sessions
    await Promise.all([
      this.ingredientRepository.update(
        { createdBy: userId },
        { createdBy: null },
      ),
      this.favoriteRepository.delete({ user: { id: userId } }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.aiRepository.update({ user: { id: userId } }, { user: null } as any),
      this.quotaRepository.delete({ user: { id: userId } }),
      this.refreshTokenRepository.delete({ userId }),
    ]);

    this.logger.log(`Deleted and anonymized data for user ${userId}`);
  }

  private async unlinkCocktailImages(cocktail: Cocktail): Promise<void> {
    const safeDelete = async (filePath: string | undefined, label: string) => {
      if (!filePath) return;
      const absolutePath = path.join(process.cwd(), filePath);
      if (!absolutePath.startsWith(path.join(process.cwd(), 'uploads'))) {
        this.logger.warn(
          `Refusing to unlink path outside uploads: ${absolutePath}`,
        );
        return;
      }
      try {
        await fs.unlink(absolutePath);
        this.logger.log(`Deleted ${label}: ${absolutePath}`);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          this.logger.error(
            `Failed to unlink ${label} ${absolutePath}: ${err.message}`,
          );
        }
      }
    };

    await safeDelete(cocktail.imageFull, 'full image');
    await safeDelete(cocktail.imageThumb, 'thumbnail');
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

    const [
      inventory,
      favorites,
      aiRecipes,
      cocktailRatings,
      preparationLogs,
      activeSessions,
    ] = await Promise.all([
      this.inventoryRepository.find({ relations: ['ingredient'] }),
      this.favoriteRepository.find({ where: { user: { id: userId } } }),
      this.aiRepository.find({ where: { user: { id: userId } } }),
      this.cocktailRatingRepository.find({
        where: { user: { id: userId } },
        relations: ['cocktail'],
      }),
      this.preparationLogRepository.find({
        where: { bartender: { id: userId } },
      }),
      this.refreshTokenRepository.count({
        where: { userId, isRevoked: false },
      }),
    ]);

    return {
      userProfile: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        lastLogin: user.lastLoginAt,
        emailVerified: user.emailVerified,
        isAnonymized: user.isAnonymized,
        activeSessions,
      },
      inventory: inventory.map((item) => ({
        ingredientId: item.ingredient.id,
        ingredientName: item.ingredient.name,
        quantity: item.quantity,
        unit: item.ingredient.baseUnit,
      })),
      favorites: favorites.map((fav) => ({
        localCocktailId: fav.cocktail?.id || null,
        externalCocktailId: fav.externalCocktailId,
        createdAt: fav.createdAt,
      })),
      cocktailRatings: cocktailRatings.map((r) => ({
        cocktailId: r.cocktail?.id,
        cocktailName: r.cocktail?.name,
        score: r.score,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      preparationHistory: preparationLogs.map((log) => ({
        cocktailName: log.cocktailNameSnapshot,
        servings: log.servings,
        status: log.status,
        undone: log.undone,
        createdAt: log.createdAt,
      })),
      aiGeneratedRecipes: aiRecipes.map((recipe) => ({
        id: recipe.id,
        prompt: recipe.prompt,
        generatedAt: recipe.createdAt,
        savedAsCocktail: recipe.savedAsCocktailId,
        validationScore: recipe.validationScore,
      })),
      exportDate: new Date().toISOString(),
    };
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

      this.logger.log(
        `Deleted user account ${userId} (GDPR right to be forgotten)`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete user account ${userId}`,
        (error as Error).message,
      );
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
    userAnonymizeThreshold.setDate(
      userAnonymizeThreshold.getDate() - this.policy.userAnonymizeThreshold,
    );

    const userDeleteThreshold = new Date(now);
    userDeleteThreshold.setDate(
      userDeleteThreshold.getDate() - this.policy.userInactiveThreshold,
    );

    const inventoryThreshold = new Date(now);
    inventoryThreshold.setDate(
      inventoryThreshold.getDate() - this.policy.inventoryHistoryThreshold,
    );

    const aiDataThreshold = new Date(now);
    aiDataThreshold.setDate(
      aiDataThreshold.getDate() - this.policy.aiGeneratedDataThreshold,
    );

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
          isAnonymized: false,
        },
      }),
      this.userRepository.count({
        where: {
          lastLoginAt: LessThan(userDeleteThreshold),
          isAnonymized: true,
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
