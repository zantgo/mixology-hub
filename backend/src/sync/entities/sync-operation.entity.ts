import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum SyncOperationStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  FAILED = 'failed'
}

export enum SyncOperationType {
  INVENTORY_UPDATE = 'inventory_update',
  COCKTAIL_RATING = 'cocktail_rating',
  FAVORITE_TOGGLE = 'favorite_toggle',
  COCKTAIL_PREPARATION = 'cocktail_preparation'
}

@Entity('sync_operations')
export class SyncOperation {
  @ApiProperty({ description: 'Unique identifier of the sync operation' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Client-generated operation ID for idempotency' })
  @Column({ name: 'client_operation_id' })
  clientOperationId: string;

  @ApiProperty({ description: 'User who created this operation' })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ enum: SyncOperationType, description: 'Type of operation' })
  @Column({ name: 'operation_type' })
  operationType: SyncOperationType;

  @ApiProperty({ description: 'Operation payload as JSON' })
  @Column({ type: 'jsonb' })
  payload: any;

  @ApiProperty({ enum: SyncOperationStatus, description: 'Current status of the operation' })
  @Column({ default: SyncOperationStatus.PENDING })
  status: SyncOperationStatus;

  @ApiProperty({ description: 'Error message if operation failed', nullable: true })
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @ApiProperty({ description: 'Timestamp from user device when operation was created' })
  @Column({ name: 'device_timestamp' })
  deviceTimestamp: Date;

  @ApiProperty({ description: 'Timestamp when operation was processed on server', nullable: true })
  @Column({ name: 'server_timestamp', nullable: true })
  serverTimestamp: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}