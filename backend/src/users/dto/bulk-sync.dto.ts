import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { DepleteInventoryDto } from './deplete-inventory.dto';

export class BulkSyncItemDto extends DepleteInventoryDto {
  @ApiProperty({ description: 'Unique identifier for this operation (client-generated)' })
  clientOperationId: string;

  @ApiProperty({ description: 'Timestamp when the operation was performed offline' })
  offlineTimestamp: Date;
}

export class BulkSyncDto {
  @ApiProperty({ 
    type: [BulkSyncItemDto],
    description: 'List of inventory depletion operations to sync',
    example: [
      {
        clientOperationId: 'op-123',
        offlineTimestamp: '2024-01-15T10:30:00Z',
        ingredients: [
          { ingredientId: 'ing-1', amount: 2, unit: 'oz' },
          { ingredientId: 'ing-2', amount: 1, unit: 'units' }
        ]
      }
    ]
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkSyncItemDto)
  operations: BulkSyncItemDto[];
}

export interface BulkSyncResultItem {
  clientOperationId: string;
  success: boolean;
  depletedItems?: Array<{ ingredientId: string; amountDepleted: number }>;
  error?: string;
}

export interface BulkSyncResult {
  results: BulkSyncResultItem[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}