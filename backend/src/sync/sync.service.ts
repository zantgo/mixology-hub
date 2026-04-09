import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncOperation, SyncOperationStatus, SyncOperationType } from './entities/sync-operation.entity';
import { User } from '../users/entities/user.entity';

export interface SyncOperationDto {
  clientOperationId: string;
  operationType: SyncOperationType;
  payload: any;
  deviceTimestamp: Date;
}

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SyncOperation)
    private syncOperationRepository: Repository<SyncOperation>,
  ) {}

  async processSyncOperations(user: User, operations: SyncOperationDto[]): Promise<SyncOperation[]> {
    const results: SyncOperation[] = [];

    for (const operationDto of operations) {
      try {
        // Check for duplicate operation (idempotency)
        const existing = await this.syncOperationRepository.findOne({
          where: {
            clientOperationId: operationDto.clientOperationId,
            userId: user.id,
          },
        });

        if (existing) {
          if (existing.status === SyncOperationStatus.SYNCED) {
            // Already processed successfully - return existing result
            results.push(existing);
            continue;
          } else if (existing.status === SyncOperationStatus.FAILED) {
            // Previously failed - retry
            await this.syncOperationRepository.remove(existing);
          }
        }

        // Create new sync operation
        const syncOperation = this.syncOperationRepository.create({
          clientOperationId: operationDto.clientOperationId,
          user,
          userId: user.id,
          operationType: operationDto.operationType,
          payload: operationDto.payload,
          deviceTimestamp: operationDto.deviceTimestamp,
          status: SyncOperationStatus.PENDING,
        });

        // Process the operation based on type
        try {
          await this.processOperation(syncOperation);
          syncOperation.status = SyncOperationStatus.SYNCED;
          syncOperation.serverTimestamp = new Date();
        } catch (error) {
          syncOperation.status = SyncOperationStatus.FAILED;
          syncOperation.errorMessage = error.message;
        }

        // Save the result
        const saved = await this.syncOperationRepository.save(syncOperation);
        results.push(saved);

      } catch (error) {
        // Create a failed operation record for this specific operation
        const failedOperation = this.syncOperationRepository.create({
          clientOperationId: operationDto.clientOperationId,
          user,
          userId: user.id,
          operationType: operationDto.operationType,
          payload: operationDto.payload,
          deviceTimestamp: operationDto.deviceTimestamp,
          status: SyncOperationStatus.FAILED,
          errorMessage: error.message,
          serverTimestamp: new Date(),
        });
        await this.syncOperationRepository.save(failedOperation);
        results.push(failedOperation);
      }
    }

    return results;
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    // This method would integrate with other services
    // For now, it's a placeholder that simulates processing
    switch (operation.operationType) {
      case SyncOperationType.INVENTORY_UPDATE:
        // Call inventory service
        break;
      case SyncOperationType.COCKTAIL_RATING:
        // Call rating service (which will handle auto-forking for external cocktails)
        break;
      case SyncOperationType.FAVORITE_TOGGLE:
        // Call favorites service
        break;
      case SyncOperationType.COCKTAIL_PREPARATION:
        // Call preparation service
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.operationType}`);
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async getUserSyncOperations(user: User, status?: SyncOperationStatus): Promise<SyncOperation[]> {
    const where: any = { userId: user.id };
    if (status) {
      where.status = status;
    }

    return this.syncOperationRepository.find({
      where,
      order: { deviceTimestamp: 'DESC' },
      take: 100, // Limit to recent operations
    });
  }

  async retryFailedOperation(user: User, operationId: string): Promise<SyncOperation> {
    const operation = await this.syncOperationRepository.findOne({
      where: {
        id: operationId,
        userId: user.id,
        status: SyncOperationStatus.FAILED,
      },
    });

    if (!operation) {
      throw new NotFoundException('Failed operation not found');
    }

    // Remove the failed record and reprocess
    await this.syncOperationRepository.remove(operation);
    
    const newOperationDto: SyncOperationDto = {
      clientOperationId: operation.clientOperationId,
      operationType: operation.operationType,
      payload: operation.payload,
      deviceTimestamp: operation.deviceTimestamp,
    };

    const [result] = await this.processSyncOperations(user, [newOperationDto]);
    return result;
  }
}