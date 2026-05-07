import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { Ai } from '../ai/entities/ai.entity';
import { ConfigService } from '@nestjs/config';
export interface DataRetentionPolicy {
    userInactiveThreshold: number;
    userAnonymizeThreshold: number;
    inventoryHistoryThreshold: number;
    aiGeneratedDataThreshold: number;
    logDataThreshold: number;
}
export declare class GdprDataRetentionService {
    private readonly userRepository;
    private readonly inventoryRepository;
    private readonly aiRepository;
    private readonly configService;
    private readonly logger;
    private readonly policy;
    constructor(userRepository: Repository<User>, inventoryRepository: Repository<UserInventory>, aiRepository: Repository<Ai>, configService: ConfigService);
    runDataRetentionCleanup(): Promise<void>;
    anonymizeInactiveUsers(): Promise<number>;
    deleteInactiveUsers(): Promise<number>;
    cleanupOldInventoryData(): Promise<number>;
    cleanupOldAiData(): Promise<number>;
    private anonymizeUser;
    private deleteUserData;
    exportUserData(userId: string): Promise<any>;
    deleteUserAccount(userId: string): Promise<boolean>;
    getRetentionStats(): Promise<any>;
}
